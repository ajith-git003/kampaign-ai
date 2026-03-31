# Kampaign.ai — AI-native campaign engine
# Celery daily pipeline task
#
# Pipeline:
#   1. Fetch campaign metrics from Meta Marketing API
#   2. Persist CampaignMetric rows to PostgreSQL
#   3. Run Isolation Forest anomaly detection
#   4. Generate GPT-4o-mini insight summaries for flagged campaigns
#   5. Persist Insight rows

import asyncio
import logging

from tasks.celery_app import celery_app

logger = logging.getLogger("kampaign.tasks")


@celery_app.task(name="tasks.daily_tasks.daily_sync", bind=True, max_retries=3)
def daily_sync(self):
    """Kampaign.ai daily sync — entry point for Celery worker."""
    logger.info("Kampaign.ai | Starting daily sync task")
    try:
        asyncio.run(_async_daily_sync())
        logger.info("Kampaign.ai | Daily sync completed successfully")
    except Exception as exc:
        logger.error("Kampaign.ai | Daily sync failed: %s", exc)
        raise self.retry(exc=exc, countdown=300)  # retry after 5 minutes


async def _async_daily_sync():
    """Async implementation — runs inside asyncio.run() from the Celery task."""
    from datetime import datetime

    from sqlalchemy import select

    from database import AsyncSessionLocal
    from models import Campaign, CampaignMetric, Insight
    from services.anomaly_service import detect_anomalies
    from services.ai_service import generate_insight_summary
    from services.facebook_service import fetch_campaign_insights

    async with AsyncSessionLocal() as db:
        # Only sync campaigns that have been linked to a Meta campaign
        result = await db.execute(
            select(Campaign).where(Campaign.meta_campaign_id.isnot(None))
        )
        campaigns = result.scalars().all()
        logger.info("Kampaign.ai | Syncing %d linked campaigns", len(campaigns))

        for campaign in campaigns:
            try:
                raw_insights = await fetch_campaign_insights(campaign.meta_campaign_id)

                for entry in raw_insights:
                    metric = CampaignMetric(
                        campaign_id=campaign.id,
                        date=datetime.utcnow(),
                        impressions=int(entry.get("impressions", 0)),
                        clicks=int(entry.get("clicks", 0)),
                        spend=float(entry.get("spend", 0.0)),
                        ctr=float(entry.get("ctr", 0.0)),
                        cpc=float(entry.get("cpc", 0.0)),
                        raw_data=entry,
                    )
                    db.add(metric)

                await db.commit()

                # Pull recent metrics and run anomaly detection
                metrics_result = await db.execute(
                    select(CampaignMetric)
                    .where(CampaignMetric.campaign_id == campaign.id)
                    .order_by(CampaignMetric.date.desc())
                    .limit(30)
                )
                metrics = metrics_result.scalars().all()
                anomalies = detect_anomalies(metrics)

                if anomalies:
                    summary = await generate_insight_summary(
                        metrics_summary=f"Campaign '{campaign.name}'",
                        anomalies=[a["message"] for a in anomalies],
                    )
                    insight = Insight(
                        campaign_id=campaign.id,
                        insight_type="daily_summary",
                        content=summary,
                        severity="warning",
                    )
                    db.add(insight)
                    await db.commit()
                    logger.info(
                        "Kampaign.ai | Persisted insight for campaign %s", campaign.id
                    )

            except Exception as exc:
                logger.error(
                    "Kampaign.ai | Failed to sync campaign %s: %s", campaign.id, exc
                )
                await db.rollback()
