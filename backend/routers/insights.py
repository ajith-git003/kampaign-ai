# Kampaign.ai — AI-native campaign engine
# Insights router — per-campaign anomaly detection + GPT-4o-mini recommendations + actions

import logging
from uuid import UUID
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import Insight
from services.anomaly_service import detect_anomalies
from services.ai_service import generate_insights, get_metrics_summary, regenerate_single_action

router = APIRouter()
logger = logging.getLogger("kampaign.insights")


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class InsightResponse(BaseModel):
    id:             UUID
    campaign_id:    Optional[UUID]
    insight_type:   str
    content:        str
    severity:       str
    acknowledged:   bool
    created_at:     datetime

    model_config = {"from_attributes": True}


# ── Existing endpoints ─────────────────────────────────────────────────────────

@router.get("/", response_model=list[InsightResponse])
async def list_insights(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Insight).order_by(Insight.created_at.desc()).limit(50)
    )
    return result.scalars().all()


@router.post("/{insight_id}/acknowledge", response_model=InsightResponse)
async def acknowledge_insight(insight_id: UUID, db: AsyncSession = Depends(get_db)):
    insight = await db.get(Insight, insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    insight.acknowledged = True
    await db.flush()
    await db.refresh(insight)
    return insight


# ── AI insights engine ─────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_insights_endpoint(db: AsyncSession = Depends(get_db)):
    """
    Full agentic insights pipeline:
      1. detect_anomalies()    — per-campaign ROAS / CTR / spend analysis
      2. get_metrics_summary() — per-campaign aggregate KPIs
      3. generate_insights()   — GPT-4o-mini analyst text + actions JSON
      4. Persist insight to DB

    Returns {insight_text, anomalies, actions, generated_at}
    """
    try:
        logger.info("Kampaign.ai | Insights: starting pipeline")

        anomalies       = await detect_anomalies(db)
        metrics_summary = await get_metrics_summary(db)
        insight_text, actions = await generate_insights(anomalies, metrics_summary)

        insight = Insight(
            insight_type="ai_generated",
            content=insight_text,
            severity="warning" if anomalies else "info",
            actions_json=actions,
        )
        db.add(insight)
        await db.flush()
        await db.refresh(insight)

        logger.info(
            "Kampaign.ai | Insights: complete — %d anomalies, %d actions, saved id=%s",
            len(anomalies), len(actions), insight.id,
        )

        return {
            "insight_text": insight_text,
            "anomalies":    anomalies,
            "actions":      actions,
            "generated_at": insight.created_at,
        }

    except Exception as exc:
        logger.error("Kampaign.ai | Insights: pipeline failed — %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/history")
async def insights_history(db: AsyncSession = Depends(get_db)):
    """Return the last 10 AI-generated insights, newest first."""
    try:
        result = await db.execute(
            select(Insight)
            .where(Insight.insight_type == "ai_generated")
            .order_by(Insight.created_at.desc())
            .limit(10)
        )
        rows = result.scalars().all()
        return [
            {"id": str(r.id), "insight_text": r.content, "generated_at": r.created_at}
            for r in rows
        ]
    except Exception as exc:
        logger.error("Kampaign.ai | Insights: history fetch failed — %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/latest")
async def latest_insight(db: AsyncSession = Depends(get_db)):
    """Return the most recent AI-generated insight with its actions array."""
    try:
        result = await db.execute(
            select(Insight)
            .where(Insight.insight_type == "ai_generated")
            .order_by(Insight.created_at.desc())
            .limit(1)
        )
        row = result.scalars().first()
        if not row:
            return {"insight_text": None, "actions": [], "generated_at": None}
        return {
            "id":           str(row.id),
            "insight_text": row.content,
            "actions":      row.actions_json or [],
            "generated_at": row.created_at,
        }
    except Exception as exc:
        logger.error("Kampaign.ai | Insights: latest fetch failed — %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


class RegenerateActionRequest(BaseModel):
    original_action: dict
    user_feedback:   str
    campaign_name:   str


@router.post("/regenerate-action")
async def regenerate_action_endpoint(
    body: RegenerateActionRequest, db: AsyncSession = Depends(get_db)
):
    """
    Human-in-the-loop: user provides feedback on an AI action.
    Pulls campaign metrics, calls GPT-4o-mini to produce a revised action.
    Returns {revised_action}.
    """
    try:
        metrics_summary = await get_metrics_summary(db)
        revised = await regenerate_single_action(
            original_action=body.original_action,
            user_feedback=body.user_feedback,
            campaign_metrics_summary=metrics_summary,
        )
        logger.info(
            "Kampaign.ai | Insights: regenerated action for '%s'", body.campaign_name
        )
        return {"revised_action": revised}
    except Exception as exc:
        logger.error("Kampaign.ai | Insights: regenerate-action failed — %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
