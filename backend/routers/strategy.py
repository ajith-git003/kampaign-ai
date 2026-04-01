# Kampaign.ai — AI-native campaign engine
# Strategy router — AI campaign strategy builder via GPT-4o-mini

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ai_service import get_openai_client

router = APIRouter()
logger = logging.getLogger("kampaign.strategy")

_STRATEGY_SYSTEM_PROMPT = (
    "You are an expert Facebook ads strategist specializing in DTC brands in India. "
    "Generate a complete campaign strategy. "
    "Always respond in valid JSON only. No markdown, no backticks, just raw JSON."
)


class StrategyRequest(BaseModel):
    niche: str
    product_name: str
    product_price_inr: float
    objective: str
    monthly_budget_inr: float
    target_audience_description: str


@router.post("/generate")
async def generate_strategy(body: StrategyRequest):
    """
    Generate a complete 3-stage Facebook ads strategy using GPT-4o-mini.
    Returns funnel stages, KPI benchmarks, 90-day projections, tools, and launch checklist.
    """
    user_prompt = f"""Generate a complete Facebook ads strategy for:
Niche: {body.niche}
Product: {body.product_name} priced at ₹{body.product_price_inr:,.0f}
Objective: {body.objective}
Monthly Budget: ₹{body.monthly_budget_inr:,.0f}
Target Audience: {body.target_audience_description}

Return this exact JSON structure:
{{
  "summary": "2-3 sentence overview of the strategy",
  "funnel_stages": [
    {{
      "stage": "TOF",
      "name": "Top of Funnel",
      "objective": "campaign objective string",
      "audience_type": "Interest / Lookalike / Broad",
      "audience_description": "detailed audience description",
      "budget_pct": 40,
      "budget_inr": {body.monthly_budget_inr * 0.4:.0f},
      "campaign_name_suggestion": "suggested campaign name",
      "ad_format": "Video / Image / Carousel / Reels",
      "creative_guidance": "what the ad should show/say",
      "kpis": {{
        "expected_cpm_inr": 80.0,
        "expected_cpc_inr": 8.0,
        "expected_ctr_pct": 1.2,
        "expected_roas": 1.5
      }}
    }},
    {{
      "stage": "MOF",
      "name": "Middle of Funnel",
      "objective": "campaign objective string",
      "audience_type": "Retargeting",
      "audience_description": "detailed audience description",
      "budget_pct": 35,
      "budget_inr": {body.monthly_budget_inr * 0.35:.0f},
      "campaign_name_suggestion": "suggested campaign name",
      "ad_format": "Carousel / Image",
      "creative_guidance": "what the ad should show/say",
      "kpis": {{
        "expected_cpm_inr": 120.0,
        "expected_cpc_inr": 12.0,
        "expected_ctr_pct": 1.8,
        "expected_roas": 3.0
      }}
    }},
    {{
      "stage": "BOF",
      "name": "Bottom of Funnel",
      "objective": "campaign objective string",
      "audience_type": "Cart Abandoners / Purchasers",
      "audience_description": "detailed audience description",
      "budget_pct": 25,
      "budget_inr": {body.monthly_budget_inr * 0.25:.0f},
      "campaign_name_suggestion": "suggested campaign name",
      "ad_format": "Dynamic / Carousel",
      "creative_guidance": "what the ad should show/say",
      "kpis": {{
        "expected_cpm_inr": 150.0,
        "expected_cpc_inr": 15.0,
        "expected_ctr_pct": 2.5,
        "expected_roas": 5.0
      }}
    }}
  ],
  "tools_required": [
    {{"tool": "Facebook Pixel", "purpose": "Track conversions and build audiences", "free": true}},
    {{"tool": "Meta Ads Manager", "purpose": "Campaign management and reporting", "free": true}},
    {{"tool": "Canva", "purpose": "Ad creative design", "free": true}},
    {{"tool": "Google Analytics 4", "purpose": "Landing page performance tracking", "free": true}},
    {{"tool": "Klaviyo", "purpose": "Email retargeting for cart abandoners", "free": false}}
  ],
  "projections": {{
    "month_1": {{
      "spend_inr": {body.monthly_budget_inr:.0f},
      "estimated_clicks": 0,
      "estimated_purchases": 0,
      "estimated_revenue_inr": 0.0,
      "estimated_roas": 0.0
    }},
    "month_2": {{
      "spend_inr": {body.monthly_budget_inr:.0f},
      "estimated_clicks": 0,
      "estimated_purchases": 0,
      "estimated_revenue_inr": 0.0,
      "estimated_roas": 0.0
    }},
    "month_3": {{
      "spend_inr": {body.monthly_budget_inr:.0f},
      "estimated_clicks": 0,
      "estimated_purchases": 0,
      "estimated_revenue_inr": 0.0,
      "estimated_roas": 0.0
    }}
  }},
  "funnel_metrics": {{
    "landing_page_to_cart_pct": 0.0,
    "cart_to_purchase_pct": 0.0,
    "overall_conversion_rate": 0.0
  }},
  "launch_checklist": [
    "Install Facebook Pixel on your website",
    "Create product catalogue in Meta Commerce Manager",
    "Set up Custom Conversions for Purchase and Add to Cart events",
    "Build 1% lookalike audience from customer email list",
    "Design 3 TOF video creatives (15 sec each)",
    "Set up retargeting audiences: website visitors, cart abandoners",
    "Configure UTM parameters for all ad links",
    "Create landing page with above-the-fold social proof",
    "Set up automated email flow for cart abandonment",
    "Launch TOF campaign first, wait 7 days before scaling"
  ]
}}

Fill in all numeric values with realistic estimates for the {body.niche} niche in India at ₹{body.monthly_budget_inr:,.0f}/month budget."""

    logger.info(
        "Kampaign.ai | Strategy: generating for niche='%s' product='%s' budget=₹%.0f",
        body.niche, body.product_name, body.monthly_budget_inr,
    )

    def _call() -> dict:
        raw = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _STRATEGY_SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            max_tokens=2000,
            temperature=0.4,
        ).choices[0].message.content.strip()

        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.rsplit("```", 1)[0]

        return json.loads(raw)

    try:
        loop = asyncio.get_event_loop()
        strategy = await loop.run_in_executor(None, _call)
        logger.info("Kampaign.ai | Strategy: generated successfully for '%s'", body.product_name)
        return strategy
    except json.JSONDecodeError as exc:
        logger.error("Kampaign.ai | Strategy: JSON parse failed — %s", exc)
        raise HTTPException(status_code=500, detail="Strategy generation returned invalid JSON — retry")
    except Exception as exc:
        logger.error("Kampaign.ai | Strategy: generation failed — %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
