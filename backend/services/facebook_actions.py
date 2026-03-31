# Kampaign.ai — AI-native campaign engine
# Facebook agentic actions — sync, pause, increase budget, launch

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from models import CampaignRegistry, ActionLog

logger = logging.getLogger("kampaign.fb_actions")


# ── Facebook API helpers ───────────────────────────────────────────────────────

def _init_api():
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


def _facebook_url(fb_campaign_id: str) -> str:
    """Direct link to the campaign in Facebook Ads Manager."""
    numeric_id = settings.meta_ad_account_id.replace("act_", "")
    return (
        f"https://www.facebook.com/adsmanager/manage/campaigns"
        f"?act={numeric_id}&selected_campaign_ids={fb_campaign_id}"
    )


def verify_campaign_status(fb_campaign_id: str) -> str:
    """
    Re-fetch campaign status from Facebook API to confirm a change took effect.
    Returns the current status string (e.g. "PAUSED", "ACTIVE").
    """
    from facebook_business.adobjects.campaign import Campaign
    _init_api()
    campaign = Campaign(fbid=fb_campaign_id)
    result = campaign.api_get(fields=[Campaign.Field.status])
    return result[Campaign.Field.status]


# ── Action logging helper ──────────────────────────────────────────────────────

async def _log_action(
    db: AsyncSession,
    action_type: str,
    campaign_name: str,
    fb_campaign_id: str | None,
    details: dict,
    success: bool,
    result: dict,
) -> None:
    entry = ActionLog(
        action_type=action_type,
        campaign_name=campaign_name,
        fb_campaign_id=fb_campaign_id,
        details=details,
        success=success,
        result=result,
        executed_at=datetime.utcnow(),
    )
    db.add(entry)
    await db.flush()


# ── Registry lookup ────────────────────────────────────────────────────────────

async def _get_registry_entry(
    db: AsyncSession, campaign_name: str
) -> CampaignRegistry | None:
    result = await db.execute(
        select(CampaignRegistry).where(CampaignRegistry.campaign_name == campaign_name)
    )
    return result.scalar_one_or_none()


# ── 1. Sync campaigns from Facebook ───────────────────────────────────────────

async def sync_campaigns_from_facebook(db: AsyncSession) -> list[dict[str, Any]]:
    """
    Fetch all campaigns from the Facebook Ads account, match by name against
    the 8 Glowra campaigns, and upsert into campaign_registry.

    Returns list of {campaign_name, fb_campaign_id, fb_status, matched}.
    """
    logger.info("Kampaign.ai | FB Actions: syncing campaigns from Facebook")

    try:
        account   = _get_ad_account()
        fb_camps  = account.get_campaigns(
            fields=["id", "name", "status", "daily_budget"]
        )
        fb_by_name = {c["name"]: c for c in fb_camps}
        logger.info("Kampaign.ai | FB Actions: fetched %d campaigns from Facebook", len(fb_by_name))
    except Exception as exc:
        logger.error("Kampaign.ai | FB Actions: sync failed — %s", exc)
        raise

    glowra_campaigns = [
        "Glowra - Prospecting TOF",
        "Glowra - Retargeting MOF",
        "Glowra - Cart Abandonment",
        "Glowra - Lookalike 1-3%",
        "Glowra - Broad Awareness",
        "Glowra - Video Views",
        "Glowra - DPA Catalogue",
        "Glowra - Influencer UGC",
    ]

    results = []
    for name in glowra_campaigns:
        fb_data = fb_by_name.get(name)
        matched = fb_data is not None

        # Upsert into campaign_registry
        existing = await _get_registry_entry(db, name)
        if existing:
            existing.fb_campaign_id = fb_data["id"]    if fb_data else existing.fb_campaign_id
            existing.fb_status      = fb_data["status"] if fb_data else existing.fb_status
            existing.synced_at      = datetime.utcnow()
        else:
            db.add(CampaignRegistry(
                campaign_name=name,
                fb_campaign_id=fb_data["id"]     if fb_data else None,
                fb_status=fb_data["status"]      if fb_data else None,
                synced_at=datetime.utcnow(),
            ))

        results.append({
            "campaign_name":  name,
            "fb_campaign_id": fb_data["id"]     if fb_data else None,
            "fb_status":      fb_data["status"] if fb_data else None,
            "matched":        matched,
        })
        logger.info("Kampaign.ai | FB Actions: %-35s matched=%s", name, matched)

    await db.flush()
    return results


# ── 2. Pause campaign ──────────────────────────────────────────────────────────

async def pause_campaign_on_facebook(
    campaign_name: str, db: AsyncSession
) -> dict[str, Any]:
    """
    Look up fb_campaign_id from campaign_registry, call the Facebook API to
    set status = PAUSED, verify the change, and log the action.
    """
    logger.info("Kampaign.ai | FB Actions: pausing '%s'", campaign_name)

    entry = await _get_registry_entry(db, campaign_name)
    if not entry or not entry.fb_campaign_id:
        msg = f"Campaign '{campaign_name}' not found in registry — run sync-facebook first"
        logger.error("Kampaign.ai | FB Actions: %s", msg)
        await _log_action(db, "pause_campaign", campaign_name, None,
                          {}, False, {"error": msg})
        return {"success": False, "error": msg}

    fb_id = entry.fb_campaign_id
    executed_at = datetime.utcnow()

    try:
        from facebook_business.adobjects.campaign import Campaign
        _init_api()
        camp = Campaign(fbid=fb_id)
        camp.api_update(params={"status": "PAUSED"})

        # Verify the change actually took effect on Facebook
        verified_status = verify_campaign_status(fb_id)
        verified = verified_status == "PAUSED"

        entry.fb_status = verified_status
        await db.flush()

        result = {
            "success":        True,
            "action_type":    "pause_campaign",
            "campaign_name":  campaign_name,
            "fb_campaign_id": fb_id,
            "new_status":     verified_status,
            "verified":       verified,
            "facebook_url":   _facebook_url(fb_id),
            "executed_at":    executed_at.isoformat(),
        }
        await _log_action(db, "pause_campaign", campaign_name, fb_id, {}, True, result)
        logger.info(
            "Kampaign.ai | FB Actions: paused '%s' (id=%s) verified_status=%s",
            campaign_name, fb_id, verified_status,
        )
        return result

    except Exception as exc:
        msg = str(exc)
        logger.error("Kampaign.ai | FB Actions: pause failed for '%s' — %s", campaign_name, msg)
        await _log_action(db, "pause_campaign", campaign_name, fb_id,
                          {}, False, {"error": msg})
        return {"success": False, "error": msg}


# ── 3+4. Unified budget update — CBO or ad-set level ──────────────────────────

FACEBOOK_MIN_BUDGET_PAISE = 10000  # ₹100 minimum daily budget


async def _update_campaign_budget(
    action_type: str,
    campaign_name: str,
    multiplier: float,
    change_pct: int,
    db: AsyncSession,
) -> dict[str, Any]:
    """
    Shared engine for increase_budget and reduce_budget.

    Strategy:
      1. Fetch campaign-level daily_budget (CBO) first.
      2. If > 0 → update at campaign level.
      3. If 0 / None → update each ad set individually.

    All budget values are in Indian Rupees (INR ₹).
    Facebook stores budgets in paise (1 INR = 100 paise).
    Minimum budget: ₹100/day (10000 paise).
    """
    entry = await _get_registry_entry(db, campaign_name)
    if not entry or not entry.fb_campaign_id:
        msg = f"Campaign '{campaign_name}' not in registry — run sync-facebook first"
        await _log_action(db, action_type, campaign_name, None,
                          {"change_pct": change_pct}, False, {"error": msg})
        return {"success": False, "error": msg}

    fb_id = entry.fb_campaign_id
    executed_at = datetime.utcnow()

    try:
        from facebook_business.adobjects.campaign import Campaign
        from facebook_business.adobjects.adset import AdSet
        _init_api()

        camp = Campaign(fbid=fb_id)

        # ── Try CBO (campaign-level budget) first ─────────────────────────────
        camp_data = camp.api_get(
            fields=[Campaign.Field.daily_budget, Campaign.Field.name, Campaign.Field.status]
        )
        cbo_raw = camp_data.get(Campaign.Field.daily_budget) or camp_data.get("daily_budget")
        cbo_paise = int(cbo_raw) if cbo_raw else 0

        logger.info(
            "Kampaign.ai | FB Actions: '%s' — CBO daily_budget_paise=%d (₹%.2f)",
            campaign_name, cbo_paise, cbo_paise / 100,
        )

        if cbo_paise > 0:
            # ── CBO path ──────────────────────────────────────────────────────
            budget_source = "campaign level (CBO)"
            old_paise = cbo_paise
            new_paise = int(old_paise * multiplier)

            # Minimum budget check before sending to Facebook
            if new_paise < FACEBOOK_MIN_BUDGET_PAISE:
                logger.warning(
                    "Kampaign.ai | FB Actions: '%s' new budget ₹%.2f is below minimum ₹%.2f — blocked",
                    campaign_name, new_paise / 100, FACEBOOK_MIN_BUDGET_PAISE / 100,
                )
                return {
                    "success":             False,
                    "error":               "minimum_budget",
                    "message":             (
                        f"Cannot reduce budget below ₹{FACEBOOK_MIN_BUDGET_PAISE // 100}/day. "
                        f"Current budget is ₹{old_paise // 100}/day. "
                        f"Facebook requires a minimum of ₹{FACEBOOK_MIN_BUDGET_PAISE // 100}/day."
                    ),
                    "current_budget_inr":  old_paise / 100,
                    "minimum_budget_inr":  FACEBOOK_MIN_BUDGET_PAISE / 100,
                    "campaign_name":       campaign_name,
                    "fb_campaign_id":      fb_id,
                }

            new_paise = max(100, new_paise)
            logger.info(
                "Kampaign.ai | FB Actions: CBO update %d → %d paise (₹%.2f → ₹%.2f)",
                old_paise, new_paise, old_paise / 100, new_paise / 100,
            )
            camp.api_update(params={"daily_budget": new_paise})

        else:
            # ── Ad set level path ─────────────────────────────────────────────
            adsets = camp.get_ad_sets(
                fields=[AdSet.Field.id, AdSet.Field.name, AdSet.Field.daily_budget]
            )
            logger.info(
                "Kampaign.ai | FB Actions: '%s' — no CBO budget, checking %d ad sets",
                campaign_name, len(list(adsets)),
            )
            # Re-fetch (iterator exhausted)
            adsets = camp.get_ad_sets(
                fields=[AdSet.Field.id, AdSet.Field.name, AdSet.Field.daily_budget]
            )

            old_paise = 0
            new_paise = 0
            adset_names = []

            for adset in adsets:
                raw = adset.get(AdSet.Field.daily_budget) or adset.get("daily_budget")
                adset_paise = int(raw) if raw else 0
                name = adset.get(AdSet.Field.name) or adset.get("name", adset["id"])

                logger.info(
                    "Kampaign.ai | FB Actions: adset '%s' daily_budget_paise=%d (₹%.2f)",
                    name, adset_paise, adset_paise / 100,
                )

                if adset_paise == 0:
                    logger.warning(
                        "Kampaign.ai | FB Actions: adset '%s' has 0 budget — skipping", name
                    )
                    continue

                new_adset_paise = int(adset_paise * multiplier)

                # Minimum budget check before sending to Facebook
                if new_adset_paise < FACEBOOK_MIN_BUDGET_PAISE:
                    logger.warning(
                        "Kampaign.ai | FB Actions: '%s' adset '%s' new budget ₹%.2f below minimum — blocked",
                        campaign_name, name, new_adset_paise / 100,
                    )
                    return {
                        "success":             False,
                        "error":               "minimum_budget",
                        "message":             (
                            f"Cannot reduce budget below ₹{FACEBOOK_MIN_BUDGET_PAISE // 100}/day. "
                            f"Current budget is ₹{adset_paise // 100}/day. "
                            f"Facebook requires a minimum of ₹{FACEBOOK_MIN_BUDGET_PAISE // 100}/day."
                        ),
                        "current_budget_inr":  adset_paise / 100,
                        "minimum_budget_inr":  FACEBOOK_MIN_BUDGET_PAISE / 100,
                        "campaign_name":       campaign_name,
                        "fb_campaign_id":      fb_id,
                    }

                new_adset_paise = max(100, new_adset_paise)
                AdSet(fbid=adset[AdSet.Field.id]).api_update(
                    params={"daily_budget": new_adset_paise}
                )
                logger.info(
                    "Kampaign.ai | FB Actions: adset '%s' %d → %d paise (₹%.2f → ₹%.2f)",
                    name, adset_paise, new_adset_paise,
                    adset_paise / 100, new_adset_paise / 100,
                )
                old_paise = adset_paise
                new_paise = new_adset_paise
                adset_names.append(name)

            budget_source = f"ad set level ({len(adset_names)} ad sets)"

        # ── Verify + build result ─────────────────────────────────────────────
        verified_status = verify_campaign_status(fb_id)
        change_amount = round((new_paise - old_paise) / 100, 2)
        sign = "+" if change_amount >= 0 else ""

        logger.info(
            "Kampaign.ai | FB Actions: '%s' budget update complete — "
            "₹%.2f → ₹%.2f (%s₹%.2f, %+d%%) source=%s",
            campaign_name,
            old_paise / 100, new_paise / 100, sign, change_amount, change_pct,
            budget_source,
        )

        result = {
            "success":           True,
            "action_type":       action_type,
            "campaign_name":     campaign_name,
            "fb_campaign_id":    fb_id,
            "budget_source":     budget_source,
            "old_budget_inr":    round(old_paise / 100, 2),
            "new_budget_inr":    round(new_paise / 100, 2),
            "change_amount_inr": change_amount,
            "change_pct":        change_pct,
            "new_status":        verified_status,
            "verified":          True,
            "facebook_url":      _facebook_url(fb_id),
            "executed_at":       executed_at.isoformat(),
        }
        await _log_action(db, action_type, campaign_name, fb_id,
                          {"change_pct": change_pct, "budget_source": budget_source},
                          True, result)
        return result

    except Exception as exc:
        msg = str(exc)
        logger.error("Kampaign.ai | FB Actions: budget update failed for '%s' — %s", campaign_name, msg)
        await _log_action(db, action_type, campaign_name, fb_id,
                          {"change_pct": change_pct}, False, {"error": msg})
        return {"success": False, "error": msg}


async def increase_campaign_budget(
    campaign_name: str, increase_pct: int, db: AsyncSession
) -> dict[str, Any]:
    return await _update_campaign_budget(
        action_type="increase_budget",
        campaign_name=campaign_name,
        multiplier=1 + (increase_pct / 100),
        change_pct=increase_pct,
        db=db,
    )


async def reduce_campaign_budget(
    campaign_name: str, reduce_pct: int, db: AsyncSession
) -> dict[str, Any]:
    return await _update_campaign_budget(
        action_type="reduce_budget",
        campaign_name=campaign_name,
        multiplier=1 - (reduce_pct / 100),
        change_pct=-reduce_pct,
        db=db,
    )


# ── 5. Launch new campaign ─────────────────────────────────────────────────────

async def launch_new_campaign(
    campaign_name: str,
    objective: str,
    daily_budget_usd: float,
    headline: str,
    body: str,
    destination_url: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """
    Create a new campaign via facebook_service, save to campaign_registry,
    and log the action.
    """
    logger.info("Kampaign.ai | FB Actions: launching new campaign '%s'", campaign_name)

    # Budget: Facebook expects budget in smallest currency unit (paise for INR, cents for USD)
    daily_budget_cents = int(daily_budget_usd * 100)

    try:
        from services.facebook_service import create_campaign
        fb_result = await create_campaign(
            name=campaign_name,
            objective=objective,
            daily_budget_cents=daily_budget_cents,
        )
        fb_id = fb_result.get("id")

        # Register in campaign_registry
        existing = await _get_registry_entry(db, campaign_name)
        if existing:
            existing.fb_campaign_id = fb_id
            existing.fb_status      = "PAUSED"
            existing.synced_at      = datetime.utcnow()
        else:
            db.add(CampaignRegistry(
                campaign_name=campaign_name,
                fb_campaign_id=fb_id,
                fb_status="PAUSED",
            ))
        await db.flush()

        result = {
            "success":          True,
            "action_type":      "launch_campaign",
            "campaign_name":    campaign_name,
            "fb_campaign_id":   fb_id,
            "new_status":       "PAUSED",
            "verified":         False,
            "objective":        objective,
            "daily_budget_usd": daily_budget_usd,
            "facebook_url":     _facebook_url(fb_id) if fb_id else None,
            "executed_at":      datetime.utcnow().isoformat(),
            "note":             "Campaign created as PAUSED — activate in Ads Manager",
        }
        await _log_action(db, "launch_campaign", campaign_name, fb_id,
                          {"headline": headline, "body": body,
                           "destination_url": destination_url}, True, result)
        logger.info("Kampaign.ai | FB Actions: launched '%s' → fb_id=%s", campaign_name, fb_id)
        return result

    except Exception as exc:
        msg = str(exc)
        logger.error("Kampaign.ai | FB Actions: launch failed for '%s' — %s", campaign_name, msg)
        await _log_action(db, "launch_campaign", campaign_name, None,
                          {}, False, {"error": msg})
        return {"success": False, "error": msg}
