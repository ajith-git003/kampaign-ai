# Kampaign.ai — AI-native campaign engine
# Celery application factory

from celery import Celery
from celery.schedules import crontab

from config import settings

celery_app = Celery(
    "kampaign",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["tasks.daily_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        # Kampaign.ai daily pipeline: sync Meta metrics → anomaly detection → GPT insights
        "daily-metric-sync": {
            "task": "tasks.daily_tasks.daily_sync",
            # Runs every day at 06:00 UTC; switch to a shorter interval during development
            "schedule": crontab(hour=6, minute=0),
        },
    },
)
