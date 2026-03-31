# Kampaign.ai — AI-native campaign engine
# Meta Marketing API service (facebook-business SDK)
#
# [REQUIRED] Set these in .env:
#   META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN, META_AD_ACCOUNT_ID
# Docs: https://developers.facebook.com/docs/marketing-apis

import logging
from typing import Any

from config import settings

logger = logging.getLogger("kampaign.facebook")


def _init_api():
    """Initialise FacebookAdsApi with credentials from settings."""
    from facebook_business.api import FacebookAdsApi

    FacebookAdsApi.init(
        app_id=settings.meta_app_id,
        app_secret=settings.meta_app_secret,
        access_token=settings.meta_access_token,
    )


def _get_ad_account():
    from facebook_business.adobjects.adaccount import AdAccount

    _init_api()
    return AdAccount(settings.meta_ad_account_id)


async def fetch_campaigns() -> list[dict[str, Any]]:
    """Return all campaigns for the configured Meta ad account."""
    try:
        account = _get_ad_account()
        campaigns = account.get_campaigns(
            fields=["id", "name", "status", "objective", "daily_budget"]
        )
        return [dict(c) for c in campaigns]
    except Exception as exc:
        logger.error("Kampaign.ai | Failed to fetch Meta campaigns: %s", exc)
        raise


async def fetch_campaign_insights(
    meta_campaign_id: str, date_preset: str = "last_7d"
) -> list[dict[str, Any]]:
    """Fetch performance insights for a single Meta campaign."""
    try:
        from facebook_business.adobjects.campaign import Campaign

        _init_api()
        campaign = Campaign(meta_campaign_id)
        insights = campaign.get_insights(
            params={"date_preset": date_preset},
            fields=["impressions", "clicks", "spend", "actions", "ctr", "cpc"],
        )
        return [dict(i) for i in insights]
    except Exception as exc:
        logger.error(
            "Kampaign.ai | Failed to fetch insights for campaign %s: %s",
            meta_campaign_id,
            exc,
        )
        raise


async def create_campaign(
    name: str, objective: str, daily_budget_cents: int
) -> dict[str, Any]:
    """
    Create a new campaign on Meta (starts PAUSED) and return its data.
    daily_budget_cents: budget in the account currency's smallest unit (e.g. cents).
    """
    try:
        from facebook_business.adobjects.campaign import Campaign as MetaCampaign

        account = _get_ad_account()
        # Map legacy objective names → current Facebook API values
        OBJECTIVE_MAP = {
            "LINK_CLICKS":      "OUTCOME_TRAFFIC",
            "CONVERSIONS":      "OUTCOME_SALES",
            "BRAND_AWARENESS":  "OUTCOME_AWARENESS",
            "REACH":            "OUTCOME_AWARENESS",
            "VIDEO_VIEWS":      "OUTCOME_ENGAGEMENT",
            "LEAD_GENERATION":  "OUTCOME_LEADS",
        }
        fb_objective = OBJECTIVE_MAP.get(objective, objective)
        logger.info("Kampaign.ai | Campaign objective: %s → %s", objective, fb_objective)

        campaign = account.create_campaign(
            fields=[MetaCampaign.Field.id],
            params={
                "name": name,
                "objective": fb_objective,
                "status": "PAUSED",
                "special_ad_categories": [],
                "daily_budget": daily_budget_cents,
            },
        )
        logger.info("Kampaign.ai | Created Meta campaign id=%s", campaign["id"])
        return dict(campaign)
    except Exception as exc:
        logger.error("Kampaign.ai | Failed to create Meta campaign: %s", exc)
        raise
