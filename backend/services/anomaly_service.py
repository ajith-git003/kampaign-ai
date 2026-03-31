# Kampaign.ai — AI-native campaign engine
# Anomaly detection service — per-campaign ROAS / CTR / spend change analysis

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from statistics import mean

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import CampaignMetric

logger = logging.getLogger("kampaign.anomaly")

ROAS_DROP_THRESHOLD   = -30.0   # flag if ROAS fell more than 30 %
ROAS_ABS_THRESHOLD    =   1.5   # flag if recent avg ROAS < 1.5 regardless of change
CTR_DROP_THRESHOLD    = -30.0   # flag if CTR fell more than 30 %
SPEND_SPIKE_THRESHOLD =  50.0   # flag if spend rose more than 50 %


def _change_pct(recent: float, overall: float) -> float:
    if overall == 0:
        return 0.0
    return (recent - overall) / overall * 100


def _severity(change_pct: float, recent_roas: float | None = None) -> str:
    if recent_roas is not None and recent_roas < 1.0:
        return "high"
    if abs(change_pct) >= 50:
        return "high"
    if abs(change_pct) >= 30:
        return "medium"
    return "low"


async def detect_anomalies(db: AsyncSession, days_back: int = 14) -> list[dict]:
    """
    Load all campaign_metrics rows, group by campaign_name, and compare
    recent-window averages against all-time averages.

    Flags:
      • ROAS dropped ≥ 30 % OR recent avg ROAS < 1.5
      • CTR dropped ≥ 30 %
      • Spend spiked ≥ 50 %

    Returns list of:
      {campaign_name, metric, overall_avg, recent_avg,
       change_pct, direction, severity}
    """
    result = await db.execute(select(CampaignMetric).order_by(CampaignMetric.date.asc()))
    all_rows = result.scalars().all()

    if not all_rows:
        logger.warning("Kampaign.ai | Anomaly: campaign_metrics table is empty")
        return []

    logger.info("Kampaign.ai | Anomaly: loaded %d total rows for analysis", len(all_rows))

    # Group rows by campaign_name
    by_campaign: dict[str, list[CampaignMetric]] = defaultdict(list)
    for row in all_rows:
        key = row.campaign_name or "Unknown"
        by_campaign[key].append(row)

    logger.info("Kampaign.ai | Anomaly: found %d distinct campaigns: %s",
                len(by_campaign), list(by_campaign.keys()))

    cutoff = datetime.utcnow() - timedelta(days=days_back)
    anomalies = []

    for campaign_name, rows in by_campaign.items():
        # Recent window — fall back to last 14 rows if date filter is too strict
        recent = [r for r in rows if r.date >= cutoff]
        if len(recent) < 2:
            recent = rows[-min(14, len(rows)):]

        # All-time averages
        overall_roas  = mean(r.roas  for r in rows)
        overall_ctr   = mean(r.ctr   for r in rows)
        overall_spend = mean(r.spend for r in rows)

        # Recent averages
        recent_roas  = mean(r.roas  for r in recent)
        recent_ctr   = mean(r.ctr   for r in recent)
        recent_spend = mean(r.spend for r in recent)

        roas_chg  = _change_pct(recent_roas,  overall_roas)
        ctr_chg   = _change_pct(recent_ctr,   overall_ctr)
        spend_chg = _change_pct(recent_spend, overall_spend)

        logger.info(
            "Kampaign.ai | Anomaly: %-35s | ROAS %.2f→%.2f (%+.1f%%) | "
            "CTR %.4f→%.4f (%+.1f%%) | Spend %.2f→%.2f (%+.1f%%)",
            campaign_name,
            overall_roas, recent_roas, roas_chg,
            overall_ctr,  recent_ctr,  ctr_chg,
            overall_spend, recent_spend, spend_chg,
        )

        # ── ROAS flag ─────────────────────────────────────────────────────────
        if roas_chg < ROAS_DROP_THRESHOLD or recent_roas < ROAS_ABS_THRESHOLD:
            anomalies.append({
                "campaign_name": campaign_name,
                "metric":        "roas",
                "overall_avg":   round(overall_roas, 4),
                "recent_avg":    round(recent_roas, 4),
                "change_pct":    round(roas_chg, 2),
                "direction":     "down",
                "severity":      _severity(roas_chg, recent_roas),
            })

        # ── CTR flag ──────────────────────────────────────────────────────────
        if ctr_chg < CTR_DROP_THRESHOLD:
            anomalies.append({
                "campaign_name": campaign_name,
                "metric":        "ctr",
                "overall_avg":   round(overall_ctr, 4),
                "recent_avg":    round(recent_ctr, 4),
                "change_pct":    round(ctr_chg, 2),
                "direction":     "down",
                "severity":      _severity(ctr_chg),
            })

        # ── Spend spike flag ──────────────────────────────────────────────────
        if spend_chg > SPEND_SPIKE_THRESHOLD:
            anomalies.append({
                "campaign_name": campaign_name,
                "metric":        "spend",
                "overall_avg":   round(overall_spend, 4),
                "recent_avg":    round(recent_spend, 4),
                "change_pct":    round(spend_chg, 2),
                "direction":     "up",
                "severity":      _severity(spend_chg),
            })

    logger.info("Kampaign.ai | Anomaly: %d anomalies flagged across %d campaigns",
                len(anomalies), len(by_campaign))
    return anomalies
