# Kampaign.ai — AI-native campaign engine
# OpenAI GPT-4o-mini service — copy generation, insight generation, actions JSON
#
# [REQUIRED] Set OPENAI_API_KEY in .env
# All AI features in Kampaign.ai use GPT-4o-mini exclusively.

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any

from openai import OpenAI
from openai import AsyncOpenAI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings

logger = logging.getLogger("kampaign.ai")

# ── Client factories — called inside functions, never at import time ──────────

def get_openai_client() -> OpenAI:
    """
    Sync OpenAI client. Reads api_key at call time so load_dotenv() in
    main.py has already run. Raises clearly if the key is missing.
    """
    api_key = os.getenv("OPENAI_API_KEY") or settings.openai_api_key
    if not api_key:
        raise ValueError("Kampaign.ai | OPENAI_API_KEY not set in environment")
    masked = api_key[:8] + "..." + api_key[-4:]
    logger.info("Kampaign.ai | OpenAI sync client initialised — key: %s", masked)
    return OpenAI(api_key=api_key)


def _get_async_client() -> AsyncOpenAI:
    api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("Kampaign.ai | OPENAI_API_KEY not set in environment")
    return AsyncOpenAI(api_key=api_key)


# ── System prompts ─────────────────────────────────────────────────────────────

_COPY_SYSTEM_PROMPT = (
    "You are an expert performance marketing copywriter for Kampaign.ai, "
    "an AI-native campaign engine. Write concise, high-converting ad copy."
)

_SENIOR_ANALYST_PROMPT = (
    "You are a senior performance marketing analyst for Kampaign.ai. "
    "You analyze Facebook ad campaign data for DTC skincare brands. "
    "Be specific — always name the exact campaign in your recommendations."
)

_ACTIONS_SYSTEM_PROMPT = (
    "Convert these marketing recommendations into structured actions. "
    "Valid action_type values are ONLY these four: "
    "pause_campaign, increase_budget, reduce_budget, launch_campaign. "
    "Use reduce_budget when recommending budget cuts. "
    "Use increase_budget when recommending budget increases. "
    "Never use any other action_type values. "
    "Output ONLY valid JSON array. No markdown, no explanation, just the JSON."
)


# ── Copy generation ────────────────────────────────────────────────────────────

async def generate_copy(
    product_name: str,
    target_audience: str,
    tone: str,
    num_variants: int = 3,
) -> list[dict[str, Any]]:
    """Use GPT-4o-mini to generate ad copy variants with headline, body, cta."""
    user_prompt = (
        f"Generate {num_variants} ad copy variants for '{product_name}'. "
        f"Target audience: {target_audience}. Tone: {tone}. "
        "Return a JSON object with a 'variants' key containing an array. "
        "Each item must have 'headline', 'body', and 'cta' string fields only."
    )
    response = await _get_async_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _COPY_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.8,
    )
    raw  = response.choices[0].message.content
    data = json.loads(raw)
    if "variants" in data:
        variants = data["variants"]
    elif "ads" in data:
        variants = data["ads"]
    else:
        variants = next(v for v in data.values() if isinstance(v, list))
    logger.info("Kampaign.ai | Generated %d copy variants for '%s'", len(variants), product_name)
    return variants


# ── Metrics summary ────────────────────────────────────────────────────────────

async def get_metrics_summary(db: AsyncSession) -> dict:
    """
    Pull per-campaign aggregate KPIs from PostgreSQL (all-time).
    Returns {overall: {...}, per_campaign: [...]}
    """
    from models import CampaignMetric

    # Per-campaign breakdown
    per_q = await db.execute(
        select(
            CampaignMetric.campaign_name,
            func.avg(CampaignMetric.roas).label("avg_roas"),
            func.avg(CampaignMetric.ctr).label("avg_ctr"),
            func.avg(CampaignMetric.cpc).label("avg_cpc"),
            func.sum(CampaignMetric.spend).label("total_spend"),
            func.sum(CampaignMetric.conversions).label("total_purchases"),
            func.sum(CampaignMetric.impressions).label("total_impressions"),
        ).group_by(CampaignMetric.campaign_name)
    )
    per_campaign = []
    for row in per_q.all():
        per_campaign.append({
            "campaign_name":    row.campaign_name or "Unknown",
            "avg_roas":         round(float(row.avg_roas or 0), 4),
            "avg_ctr":          round(float(row.avg_ctr or 0), 4),
            "avg_cpc":          round(float(row.avg_cpc or 0), 4),
            "total_spend":      round(float(row.total_spend or 0), 2),
            "total_purchases":  int(row.total_purchases or 0),
            "total_impressions": int(row.total_impressions or 0),
        })

    # Overall totals
    tot_q = await db.execute(
        select(
            func.sum(CampaignMetric.spend),
            func.avg(CampaignMetric.roas),
            func.avg(CampaignMetric.ctr),
            func.sum(CampaignMetric.conversions),
            func.sum(CampaignMetric.impressions),
        )
    )
    t = tot_q.one()
    overall = {
        "total_spend":       round(float(t[0] or 0), 2),
        "avg_roas":          round(float(t[1] or 0), 4),
        "avg_ctr":           round(float(t[2] or 0), 4),
        "total_purchases":   int(t[3] or 0),
        "total_impressions": int(t[4] or 0),
    }

    logger.info(
        "Kampaign.ai | Insights: summary — %d campaigns, overall spend=%.2f, roas=%.4f",
        len(per_campaign), overall["total_spend"], overall["avg_roas"],
    )
    return {"overall": overall, "per_campaign": per_campaign}


# ── AI insight + actions generation ───────────────────────────────────────────

async def generate_insights(
    anomalies: list[dict], metrics_summary: dict
) -> tuple[str, list[dict]]:
    """
    Two sequential GPT-4o-mini calls:
      1. Analyst call  → insight_text (3-5 recommendations naming exact campaigns)
      2. Actions call  → structured actions JSON array

    Returns (insight_text, actions_list).
    """
    # ── Build user prompt ─────────────────────────────────────────────────────
    overall = metrics_summary.get("overall", {})
    per_campaign = metrics_summary.get("per_campaign", [])

    # Per-campaign ROAS summary table
    roas_table = "\n".join(
        f"  {c['campaign_name']:<40} ROAS={c['avg_roas']:.2f}  "
        f"CTR={c['avg_ctr']:.4f}  Spend=₹{c['total_spend']:,.2f}  "
        f"Purchases={c['total_purchases']}"
        for c in sorted(per_campaign, key=lambda x: x["avg_roas"])
    )

    # Anomaly list with campaign names
    if anomalies:
        anomaly_lines = "\n".join(
            f"  ⚠ [{a['severity'].upper()}] {a['campaign_name']} | "
            f"{a['metric'].upper()}: recent={a['recent_avg']} "
            f"(all-time={a['overall_avg']}, {a['change_pct']:+.1f}%, {a['direction']})"
            for a in sorted(anomalies, key=lambda x: x["severity"])
        )
    else:
        anomaly_lines = "  No significant anomalies detected."

    analyst_user_prompt = f"""Ad Account Overview (All-Time):
  Total Spend: ₹{overall.get('total_spend', 0):,.2f}
  Avg ROAS: {overall.get('avg_roas', 0):.2f}
  Avg CTR: {overall.get('avg_ctr', 0):.4f}
  Total Purchases: {overall.get('total_purchases', 0)}

Per-Campaign ROAS Summary (sorted by ROAS ascending):
{roas_table}

Anomalies Detected (recent vs all-time):
{anomaly_lines}

Generate exactly 3-5 specific, actionable recommendations.
Format each recommendation exactly as:
[METRIC] Issue: ... Action: ... Expected impact: ...
Always reference the exact campaign name in each recommendation."""

    # ── Call 1: Analyst insight text ──────────────────────────────────────────
    def _insight_call() -> str:
        resp = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SENIOR_ANALYST_PROMPT},
                {"role": "user",   "content": analyst_user_prompt},
            ],
            max_tokens=1000,
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()

    loop = asyncio.get_event_loop()
    insight_text = await loop.run_in_executor(None, _insight_call)
    logger.info("Kampaign.ai | Insights: GPT analyst returned %d chars", len(insight_text))

    # ── Call 2: Convert recommendations → structured actions JSON ─────────────
    valid_campaigns = [c["campaign_name"] for c in per_campaign]
    actions_user_prompt = f"""Recommendations:
{insight_text}

Valid campaign names (use EXACTLY as written):
{chr(10).join(f'  - {n}' for n in valid_campaigns)}

Generate a JSON array where each item has:
  action_type: one of EXACTLY these four values:
    "pause_campaign"   — when recommending to pause a campaign
    "increase_budget"  — when recommending a budget increase
    "reduce_budget"    — when recommending a budget cut or reduction
    "launch_campaign"  — when recommending a new campaign
  Never use any other action_type values.
  campaign_name: exact name from the valid list above
  reason: one sentence
  expected_impact: one sentence
  priority: "high" | "medium" | "low"
  suggested_budget_usd: number (only for launch_campaign, increase_budget, or reduce_budget, else omit)

Output ONLY the JSON array. No markdown fences."""

    def _actions_call() -> list[dict]:
        resp = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _ACTIONS_SYSTEM_PROMPT},
                {"role": "user",   "content": actions_user_prompt},
            ],
            max_tokens=800,
            temperature=0.1,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)

    try:
        actions = await loop.run_in_executor(None, _actions_call)
        logger.info("Kampaign.ai | Insights: GPT generated %d structured actions", len(actions))
    except Exception as exc:
        logger.error("Kampaign.ai | Insights: actions JSON parse failed — %s", exc)
        actions = []

    return insight_text, actions


# ── Single-action regeneration (human-in-the-loop feedback) ───────────────────

async def regenerate_single_action(
    original_action: dict,
    user_feedback: str,
    campaign_metrics_summary: dict,
) -> dict:
    """
    Given the original AI action, user's feedback text, and the campaign's
    current metrics, call GPT-4o-mini to produce a revised action object.

    Returns a single action dict with the same schema as the actions array.
    """
    campaign_name = original_action.get("campaign_name", "Unknown")
    metrics = next(
        (c for c in campaign_metrics_summary.get("per_campaign", [])
         if c["campaign_name"] == campaign_name),
        {}
    )

    user_prompt = f"""Original AI recommendation:
  Action type: {original_action.get('action_type')}
  Campaign: {campaign_name}
  Reason: {original_action.get('reason', '')}
  Expected impact: {original_action.get('expected_impact', '')}

User feedback:
  "{user_feedback}"

Campaign current metrics:
  ROAS={metrics.get('avg_roas', 'N/A')}  CTR={metrics.get('avg_ctr', 'N/A')}
  Spend=₹{metrics.get('total_spend', 'N/A')}  Purchases={metrics.get('total_purchases', 'N/A')}

Based on the user feedback, produce a revised action. Output ONLY valid JSON (no markdown):
{{
  "action_type": "pause_campaign" | "increase_budget" | "launch_campaign",
  "campaign_name": "{campaign_name}",
  "reason": "one sentence incorporating the user feedback",
  "expected_impact": "one sentence",
  "priority": "high" | "medium" | "low",
  "suggested_budget_usd": <number or omit>
}}"""

    def _call() -> dict:
        resp = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _ACTIONS_SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            max_tokens=400,
            temperature=0.2,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)

    loop = asyncio.get_event_loop()
    revised = await loop.run_in_executor(None, _call)
    logger.info("Kampaign.ai | Insights: regenerated action for '%s'", campaign_name)
    return revised


# ── Legacy helper (kept for daily_tasks pipeline) ─────────────────────────────

async def generate_insight_summary(metrics_summary: str, anomalies: list[str]) -> str:
    anomaly_text = "\n".join(anomalies) if anomalies else "None detected"
    user_prompt = (
        f"Campaign metrics summary:\n{metrics_summary}\n\n"
        f"Detected anomalies:\n{anomaly_text}\n\n"
        "Provide a 2–3 sentence actionable recommendation for the media buyer."
    )
    response = await _get_async_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": _SENIOR_ANALYST_PROMPT},
                  {"role": "user",   "content": user_prompt}],
        temperature=0.5,
    )
    return response.choices[0].message.content.strip()
