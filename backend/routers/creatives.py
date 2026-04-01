# Kampaign.ai — AI-native campaign engine
# Creatives router — generate & score ad copy via GPT-4o-mini

import asyncio
import base64
import io
import json
import logging
from uuid import UUID
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import Creative
from services.ai_service import generate_copy, get_openai_client
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


_AUDIT_SYSTEM_PROMPT = (
    "You are an expert Facebook and Instagram ad creative auditor. "
    "Analyze this ad creative against direct response advertising best practices "
    "and Facebook ad guidelines. Always respond in valid JSON only. No markdown."
)

_AUDIT_CRITERIA = """Criteria to evaluate:
1. Hook Strength - Does it grab attention in first 3 seconds?
2. Value Proposition - Is the benefit clear immediately?
3. CTA Clarity - Is there a clear call to action?
4. Text Overlay - Is text minimal and readable? (Facebook 20% rule)
5. Brand Visibility - Is the brand/product clearly shown?
6. Emotional Trigger - Does it evoke emotion or curiosity?
7. Mobile Optimization - Does it work on mobile screen?
8. Visual Quality - Is the image/video high quality and professional?"""


def _image_to_base64_jpg(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def _run_audit(b64_image: str, is_video_frame: bool, objective: str, audience: str) -> dict:
    frame_note = "This is the first frame of a video ad. " if is_video_frame else ""
    user_prompt = (
        f"{frame_note}Audit this {objective} ad creative targeting {audience}.\n\n"
        "Score each criterion from 1-10 and mark passed as true if score >= 7.\n\n"
        "Return this exact JSON:\n"
        "{\n"
        '  "overall_score": int (0-100),\n'
        '  "grade": "A/B/C/D/F",\n'
        '  "verdict": "one sentence overall assessment",\n'
        '  "criteria": [\n'
        '    {"name": str, "score": int, "passed": bool, "feedback": "specific actionable 1-2 sentences"}\n'
        "  ],\n"
        '  "strengths": [str],\n'
        '  "improvements": [str],\n'
        '  "facebook_policy_flags": [str]\n'
        "}\n\n"
        f"{_AUDIT_CRITERIA}"
    )

    raw = get_openai_client().chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _AUDIT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64_image}", "detail": "high"},
                    },
                    {"type": "text", "text": user_prompt},
                ],
            },
        ],
        max_tokens=1500,
        temperature=0.3,
    ).choices[0].message.content.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.rsplit("```", 1)[0]

    return json.loads(raw)


@router.post("/audit")
async def audit_creative(
    file: UploadFile = File(...),
    campaign_objective: str = Form(...),
    target_audience: str = Form(...),
):
    """
    Audit an ad creative (image or video) using GPT-4o vision.
    Returns scores, grade, per-criterion feedback, strengths, improvements, and policy flags.
    """
    content_type = file.content_type or ""
    filename = file.filename or ""

    allowed = {"image/jpeg", "image/png", "image/webp", "video/mp4"}
    if content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    raw_bytes = await file.read()
    if len(raw_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10 MB limit")

    is_video = content_type == "video/mp4"

    def _prepare() -> tuple[str, bool]:
        if is_video:
            # Extract first frame: write bytes to buffer, seek frame 0
            import tempfile, os
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                tmp.write(raw_bytes)
                tmp_path = tmp.name
            try:
                from PIL import ImageSequence
                # PIL can't read mp4 — use a single-frame fallback via ffmpeg if available,
                # otherwise return a placeholder grey frame
                try:
                    import subprocess
                    result = subprocess.run(
                        ["ffmpeg", "-i", tmp_path, "-frames:v", "1",
                         "-f", "image2pipe", "-vcodec", "png", "-"],
                        capture_output=True, timeout=15
                    )
                    if result.returncode == 0 and result.stdout:
                        img = Image.open(io.BytesIO(result.stdout))
                    else:
                        img = Image.new("RGB", (1080, 1080), (30, 30, 30))
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    img = Image.new("RGB", (1080, 1080), (30, 30, 30))
            finally:
                os.unlink(tmp_path)
            return _image_to_base64_jpg(img), True
        else:
            img = Image.open(io.BytesIO(raw_bytes))
            return _image_to_base64_jpg(img), False

    loop = asyncio.get_event_loop()
    b64, is_frame = await loop.run_in_executor(None, _prepare)

    def _call():
        return _run_audit(b64, is_frame, campaign_objective, target_audience)

    try:
        result = await loop.run_in_executor(None, _call)
        logger.info(
            "Kampaign.ai | Audit: completed for '%s' — score=%s grade=%s",
            filename, result.get("overall_score"), result.get("grade"),
        )
        return result
    except json.JSONDecodeError as exc:
        logger.error("Kampaign.ai | Audit: JSON parse failed — %s", exc)
        raise HTTPException(status_code=500, detail="Audit returned invalid JSON — retry")
    except Exception as exc:
        logger.error("Kampaign.ai | Audit: failed — %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
