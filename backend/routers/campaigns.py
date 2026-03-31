# Kampaign.ai — AI-native campaign engine
# Campaigns router

import logging
from uuid import UUID
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import Campaign

router = APIRouter()
logger = logging.getLogger("kampaign.campaigns")


class CampaignCreate(BaseModel):
    name: str
    objective: Optional[str] = None
    daily_budget: Optional[float] = None


class CampaignResponse(BaseModel):
    id: UUID
    name: str
    meta_campaign_id: Optional[str]
    status: str
    objective: Optional[str]
    daily_budget: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[CampaignResponse])
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))
    return result.scalars().all()


@router.post("/")
async def create_campaign(payload: CampaignCreate, db: AsyncSession = Depends(get_db)):
    """
    Create a campaign in Kampaign.ai DB, then immediately create it on Facebook
    Ads Manager via the Marketing API. Saves the Facebook campaign ID back to
    meta_campaign_id. Returns both DB record and Facebook details.
    """
    # ── 1. Save to our DB ─────────────────────────────────────────────────────
    campaign = Campaign(**payload.model_dump())
    db.add(campaign)
    await db.flush()
    await db.refresh(campaign)

    logger.info("Kampaign.ai | Campaigns: created DB record id=%s name='%s'",
                campaign.id, campaign.name)

    # ── 2. Create on Facebook ─────────────────────────────────────────────────
    fb_result = None
    fb_error  = None

    try:
        from services.facebook_actions import launch_new_campaign
        fb_result = await launch_new_campaign(
            campaign_name=payload.name,
            objective=payload.objective or "LINK_CLICKS",
            daily_budget_usd=payload.daily_budget or 50.0,
            headline="Discover Glowra Skincare",
            body="Premium skincare for your daily routine",
            destination_url="https://glowra.com",
            db=db,
        )

        if fb_result.get("success") and fb_result.get("fb_campaign_id"):
            campaign.meta_campaign_id = fb_result["fb_campaign_id"]
            await db.flush()
            await db.refresh(campaign)
            logger.info(
                "Kampaign.ai | Campaigns: Facebook campaign created fb_id=%s",
                fb_result["fb_campaign_id"],
            )
        else:
            fb_error = fb_result.get("error", "Unknown Facebook error")
            logger.warning("Kampaign.ai | Campaigns: Facebook creation failed — %s", fb_error)

    except Exception as exc:
        fb_error = str(exc)
        logger.error("Kampaign.ai | Campaigns: Facebook API error — %s", fb_error)

    # ── 3. Return enriched response ───────────────────────────────────────────
    response = {
        "id":               str(campaign.id),
        "name":             campaign.name,
        "meta_campaign_id": campaign.meta_campaign_id,
        "status":           campaign.status,
        "objective":        campaign.objective,
        "daily_budget":     campaign.daily_budget,
        "created_at":       campaign.created_at.isoformat(),
        "kampaign_success": True,
        "facebook_success": fb_result.get("success", False) if fb_result else False,
        "fb_campaign_id":   fb_result.get("fb_campaign_id") if fb_result else None,
        "fb_new_status":    fb_result.get("new_status")     if fb_result else None,
        "facebook_url":     fb_result.get("facebook_url")   if fb_result else None,
        "fb_error":         fb_error,
    }
    return response


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.patch("/{campaign_id}/status", response_model=CampaignResponse)
async def update_status(campaign_id: UUID, new_status: str, db: AsyncSession = Depends(get_db)):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = new_status
    await db.flush()
    await db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.delete(campaign)
