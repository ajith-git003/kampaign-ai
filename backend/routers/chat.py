# Kampaign.ai — AI-native campaign engine
# Chat router — conversational campaign intelligence via GPT-4o-mini

import asyncio
import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel

from database import get_db
from models import CampaignMetric
from services.ai_service import get_openai_client

router = APIRouter()
logger = logging.getLogger("kampaign.chat")

_CHAT_SYSTEM_PROMPT = (
    "You are Kampaign.ai, an expert Facebook Ads analyst for a DTC skincare brand. "
    "Answer questions about campaign performance using only the data provided. "
    "Be specific — always quote exact numbers from the data (ROAS, spend in ₹, CTR%). "
    "Keep your answer concise (3-5 sentences max). "
    "Always end your response with a JSON block on its own line in this exact format:\n"
    '```actions\n["action 1 text", "action 2 text", "action 3 text"]\n```\n'
    "Each action must be a short, implementable step (under 12 words)."
)


class ChatRequest(BaseModel):
    question: str
    campaign_name: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    suggested_actions: list[str]
    data_used: list[str]


@router.post("/ask", response_model=ChatResponse)
async def ask(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Conversational campaign intelligence.
    Fetches relevant metrics from DB, builds GPT-4o-mini prompt,
    returns answer + 3 suggested actions.
    """
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="question must not be empty")

    # ── 1. Campaign-specific metrics (last 30 rows) ───────────────────────────
    campaign_rows = []
    data_used = []

    if body.campaign_name:
        result = await db.execute(
            select(
                CampaignMetric.date,
                CampaignMetric.spend,
                CampaignMetric.roas,
                CampaignMetric.ctr,
                CampaignMetric.cpc,
                CampaignMetric.conversions,
                CampaignMetric.impressions,
            )
            .where(CampaignMetric.campaign_name == body.campaign_name)
            .order_by(CampaignMetric.date.desc())
            .limit(30)
        )
        campaign_rows = result.all()
        data_used.append(f"{body.campaign_name} — last {len(campaign_rows)} data points")

    # ── 2. Account-level summary (all campaigns) ─────────────────────────────
    summary_result = await db.execute(
        select(
            CampaignMetric.campaign_name,
            func.avg(CampaignMetric.roas).label("avg_roas"),
            func.avg(CampaignMetric.ctr).label("avg_ctr"),
            func.avg(CampaignMetric.cpc).label("avg_cpc"),
            func.sum(CampaignMetric.spend).label("total_spend"),
            func.sum(CampaignMetric.conversions).label("total_conv"),
        ).group_by(CampaignMetric.campaign_name)
        .order_by(func.avg(CampaignMetric.roas).desc())
    )
    account_rows = summary_result.all()
    data_used.append(f"Account summary — {len(account_rows)} campaigns")

    # ── 3. Build prompt context ───────────────────────────────────────────────
    account_summary = "\n".join(
        f"  {r.campaign_name:<40} ROAS={float(r.avg_roas or 0):.2f}  "
        f"CTR={float(r.avg_ctr or 0):.4f}  CPC=₹{float(r.avg_cpc or 0):.2f}  "
        f"Spend=₹{float(r.total_spend or 0):,.0f}  Purchases={int(r.total_conv or 0)}"
        for r in account_rows
    ) or "  No account data available."

    if campaign_rows:
        campaign_table = "\n".join(
            f"  {str(r.date)[:10]}  Spend=₹{float(r.spend or 0):,.0f}  "
            f"ROAS={float(r.roas or 0):.2f}  CTR={float(r.ctr or 0):.4f}  "
            f"CPC=₹{float(r.cpc or 0):.2f}  Purchases={int(r.conversions or 0)}  "
            f"Impr={int(r.impressions or 0):,}"
            for r in campaign_rows
        )
        campaign_section = (
            f"Campaign data for '{body.campaign_name}' (last {len(campaign_rows)} days):\n"
            f"{campaign_table}\n\n"
        )
    else:
        campaign_section = ""

    user_prompt = (
        f"{campaign_section}"
        f"Account averages across all campaigns:\n{account_summary}\n\n"
        f"User question: {question}"
    )

    logger.info(
        "Kampaign.ai | Chat: question='%s' campaign='%s'",
        question[:80], body.campaign_name or "all",
    )

    # ── 4. Call GPT-4o-mini ───────────────────────────────────────────────────
    def _call() -> str:
        return get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _CHAT_SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            max_tokens=600,
            temperature=0.3,
        ).choices[0].message.content.strip()

    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(None, _call)

    # ── 5. Parse answer + actions JSON block ──────────────────────────────────
    suggested_actions: list[str] = []
    answer = raw

    if "```actions" in raw:
        parts = raw.split("```actions")
        answer = parts[0].strip()
        try:
            json_block = parts[1].split("```")[0].strip()
            suggested_actions = json.loads(json_block)
        except Exception:
            logger.warning("Kampaign.ai | Chat: failed to parse actions block")

    if not suggested_actions:
        # Fallback: extract last 3 numbered/bulleted lines
        lines = [l.strip(" •-–") for l in answer.splitlines() if l.strip()]
        suggested_actions = [l for l in lines if len(l) > 10][-3:]

    logger.info(
        "Kampaign.ai | Chat: answered (%d chars, %d actions)",
        len(answer), len(suggested_actions),
    )

    return ChatResponse(
        answer=answer,
        suggested_actions=suggested_actions[:3],
        data_used=data_used,
    )
