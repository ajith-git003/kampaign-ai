# Kampaign.ai — AI-native campaign engine
# Actions router — agentic Facebook campaign execution

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import ActionLog
from services.facebook_actions import (
    sync_campaigns_from_facebook,
    pause_campaign_on_facebook,
    increase_campaign_budget,
    reduce_campaign_budget,
    launch_new_campaign,
)

router  = APIRouter()
logger  = logging.getLogger("kampaign.actions")


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class LaunchConfig(BaseModel):
    objective:       str   = "LINK_CLICKS"
    daily_budget_usd: float = 50.0
    headline:        str   = ""
    body:            str   = ""
    destination_url: str   = ""


class ExecuteActionRequest(BaseModel):
    action_type:   str               # pause_campaign | increase_budget | reduce_budget | launch_campaign
    campaign_name: str
    increase_pct:  Optional[int]     = 20
    reduce_pct:    Optional[int]     = 50
    launch_config: Optional[LaunchConfig] = None


class ActionLogResponse(BaseModel):
    id:             UUID
    action_type:    str
    campaign_name:  str
    fb_campaign_id: Optional[str]
    success:        bool
    result:         Optional[dict]
    executed_at:    datetime

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/sync-facebook")
async def sync_facebook(db: AsyncSession = Depends(get_db)):
    """
    Fetch all campaigns from the Facebook Ads account, match the 8 Glowra
    campaigns by name, and upsert into campaign_registry.
    Returns {synced: int, matched: int, campaigns: [...]}
    """
    try:
        results  = await sync_campaigns_from_facebook(db)
        matched  = sum(1 for r in results if r["matched"])
        logger.info("Kampaign.ai | Actions: sync complete — %d/%d campaigns matched",
                    matched, len(results))
        return {
            "synced":    len(results),
            "matched":   matched,
            "campaigns": results,
        }
    except Exception as exc:
        logger.error("Kampaign.ai | Actions: sync-facebook failed — %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/execute")
async def execute_action(
    body: ExecuteActionRequest, db: AsyncSession = Depends(get_db)
):
    """
    Route to the correct Facebook action function based on action_type:
      pause_campaign   → pause_campaign_on_facebook()
      increase_budget  → increase_campaign_budget()
      launch_campaign  → launch_new_campaign()
    Saves result to action_log and returns it.
    """
    logger.info("Kampaign.ai | Actions: execute %s for '%s'",
                body.action_type, body.campaign_name)

    if body.action_type == "pause_campaign":
        result = await pause_campaign_on_facebook(body.campaign_name, db)

    elif body.action_type == "increase_budget":
        result = await increase_campaign_budget(
            body.campaign_name, body.increase_pct or 20, db
        )

    elif body.action_type == "reduce_budget":
        result = await reduce_campaign_budget(
            body.campaign_name, body.reduce_pct or 50, db
        )

    elif body.action_type == "launch_campaign":
        if not body.launch_config:
            raise HTTPException(
                status_code=422,
                detail="launch_config is required for action_type=launch_campaign",
            )
        lc = body.launch_config
        result = await launch_new_campaign(
            campaign_name=body.campaign_name,
            objective=lc.objective,
            daily_budget_usd=lc.daily_budget_usd,
            headline=lc.headline,
            body=lc.body,
            destination_url=lc.destination_url,
            db=db,
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown action_type '{body.action_type}'. "
                   "Valid: pause_campaign | increase_budget | reduce_budget | launch_campaign",
        )

    return result


class DismissActionRequest(BaseModel):
    action_type:   str
    campaign_name: str
    reason:        Optional[str] = None


@router.post("/dismiss")
async def dismiss_action(
    body: DismissActionRequest, db: AsyncSession = Depends(get_db)
):
    """
    Log a user-dismissed action to action_log (success=False, details.dismissed=True).
    Returns the created log entry.
    """
    log = ActionLog(
        action_type=body.action_type,
        campaign_name=body.campaign_name,
        details={"dismissed": True, "reason": body.reason or "User dismissed"},
        success=False,
        result={"status": "dismissed"},
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)
    logger.info(
        "Kampaign.ai | Actions: dismissed %s for '%s'",
        body.action_type, body.campaign_name,
    )
    return {"status": "dismissed", "id": str(log.id)}


@router.get("/history", response_model=list[ActionLogResponse])
async def action_history(db: AsyncSession = Depends(get_db)):
    """Return the last 20 actions from action_log, newest first."""
    result = await db.execute(
        select(ActionLog)
        .order_by(ActionLog.executed_at.desc())
        .limit(20)
    )
    return result.scalars().all()
