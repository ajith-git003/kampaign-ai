# Kampaign.ai — AI-native campaign engine
# Dashboard stats router

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import CampaignRegistry, Insight

router = APIRouter()
logger = logging.getLogger("kampaign.dashboard")


@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """
    Returns live KPI counts for the Dashboard metric cards:
    - active_campaigns: rows in campaign_registry WHERE fb_status = 'ACTIVE'
    - total_campaigns:  total rows in campaign_registry
    - open_insights:    unacknowledged insights
    - ai_recommendations: actions in the most recent insight
    """
    # Active / total from campaign_registry
    reg_result = await db.execute(
        select(
            func.count().label("total"),
            func.count(
                CampaignRegistry.fb_status
            ).filter(CampaignRegistry.fb_status == "ACTIVE").label("active"),
        )
    )
    reg = reg_result.one()

    # Open (unacknowledged) insights
    open_result = await db.execute(
        select(func.count()).where(Insight.acknowledged == False)  # noqa: E712
    )
    open_insights = open_result.scalar() or 0

    # AI recommendations = number of actions in the latest insight
    latest_result = await db.execute(
        select(Insight).order_by(Insight.created_at.desc()).limit(1)
    )
    latest_insight = latest_result.scalar_one_or_none()
    ai_recs = len(latest_insight.actions_json or []) if latest_insight else 0

    logger.info(
        "Kampaign.ai | Dashboard stats: active=%d total=%d open_insights=%d ai_recs=%d",
        reg.active or 0, reg.total or 0, open_insights, ai_recs,
    )
    return {
        "active_campaigns":   int(reg.active  or 0),
        "total_campaigns":    int(reg.total   or 0),
        "open_insights":      int(open_insights),
        "ai_recommendations": int(ai_recs),
    }
