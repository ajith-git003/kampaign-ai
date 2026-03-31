# Kampaign.ai — AI-native campaign engine
# Creatives router — generate & score ad copy via GPT-4o-mini

import asyncio
import logging
from uuid import UUID
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import Creative
from services.ai_service import generate_copy
from services.scoring_service import score_creative

router = APIRouter()
logger = logging.getLogger("kampaign.creatives")


class CreativeGenerateRequest(BaseModel):
    campaign_id: Optional[UUID] = None
    product_name: str
    target_audience: str
    tone: str = "professional"
    num_variants: int = 3


class CreativeResponse(BaseModel):
    id: UUID
    campaign_id: Optional[UUID]
    headline: str
    body: Optional[str]
    cta: Optional[str]
    score: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[CreativeResponse])
async def list_creatives(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Creative).order_by(Creative.created_at.desc()))
    return result.scalars().all()


@router.post(
    "/generate",
    response_model=list[CreativeResponse],
    status_code=status.HTTP_201_CREATED,
)
async def generate_creatives(
    payload: CreativeGenerateRequest, db: AsyncSession = Depends(get_db)
):
    """
    Phase 1 (fast): Generate ad copy variants via GPT-4o-mini and save to DB
    immediately with score=None.

    Phase 2 (background): Call POST /api/creatives/score-batch with the returned
    IDs to compute sentence-transformer scores and update them.
    """
    variants = await generate_copy(
        product_name=payload.product_name,
        target_audience=payload.target_audience,
        tone=payload.tone,
        num_variants=payload.num_variants,
    )

    saved = []
    for v in variants:
        creative = Creative(
            campaign_id=payload.campaign_id,
            headline=v["headline"],
            body=v.get("body"),
            cta=v.get("cta"),
            score=None,          # scored async in phase 2
        )
        db.add(creative)
        await db.flush()
        await db.refresh(creative)
        saved.append(creative)

    logger.info(
        "Kampaign.ai | Creatives: generated %d variants (unscored) for '%s'",
        len(saved), payload.product_name,
    )
    return saved


class ScoreBatchRequest(BaseModel):
    creative_ids: list[UUID]


@router.post("/score-batch")
async def score_batch(payload: ScoreBatchRequest, db: AsyncSession = Depends(get_db)):
    """
    Phase 2: Score a batch of creatives by ID using sentence-transformers.
    Runs synchronously in a thread executor so it doesn't block the event loop.
    Call this after /generate returns, passing the IDs from that response.
    Returns list of {id, score}.
    """
    results = []
    loop = asyncio.get_event_loop()

    for cid in payload.creative_ids:
        creative = await db.get(Creative, cid)
        if not creative:
            continue

        def _score(headline=creative.headline, body=creative.body or ""):
            return score_creative(headline, body)

        score = await loop.run_in_executor(None, _score)
        creative.score = score
        await db.flush()
        results.append({"id": str(creative.id), "score": score})
        logger.debug("Kampaign.ai | Creatives: scored %s → %.4f", creative.id, score)

    logger.info(
        "Kampaign.ai | Creatives: scored %d/%d creatives",
        len(results), len(payload.creative_ids),
    )
    return results


@router.get("/{creative_id}", response_model=CreativeResponse)
async def get_creative(creative_id: UUID, db: AsyncSession = Depends(get_db)):
    creative = await db.get(Creative, creative_id)
    if not creative:
        raise HTTPException(status_code=404, detail="Creative not found")
    return creative
