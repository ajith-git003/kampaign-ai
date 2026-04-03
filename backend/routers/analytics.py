# Kampaign.ai — AI-native campaign engine
# Analytics router — campaign performance data for charts and tables

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import cast, func, select
from sqlalchemy.types import Date
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import CampaignMetric

router = APIRouter()
logger = logging.getLogger("kampaign.analytics")


def _perf_label(avg_roas: float) -> str:
    if avg_roas >= 4.0:
        return "top"
    if avg_roas >= 2.0:
        return "average"
    return "underperforming"


def _roas_trend(rows: list) -> str:
    """Compare first-half avg ROAS vs second-half to determine trend direction."""
    if len(rows) < 2:
        return "stable"
    mid         = len(rows) // 2
    first_half  = sum(r.roas for r in rows[:mid]) / mid
    second_half = sum(r.roas for r in rows[mid:]) / (len(rows) - mid)
    delta = second_half - first_half
    if delta > 0.1:
        return "up"
    if delta < -0.1:
        return "down"
    return "stable"


def _parse_date_param(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        return None


def _apply_date_filter(stmt, start: Optional[datetime], end: Optional[datetime]):
    """Apply start/end date bounds using date::date cast for exact day comparison."""
    day_col = cast(CampaignMetric.date, Date)
    if start:
        stmt = stmt.where(day_col >= start.date())
    if end:
        stmt = stmt.where(day_col <= end.date())
    return stmt


def _default_dates() -> tuple[datetime, datetime]:
    """Default range: last 30 days."""
    end   = datetime.utcnow()
    start = end - timedelta(days=30)
    return start, end


# ── Endpoint 1: overview ──────────────────────────────────────────────────────

@router.get("/overview")
async def get_overview(
    start_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end_date:   Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    start = _parse_date_param(start_date)
    end   = _parse_date_param(end_date)
    if not start and not end:
        start, end = _default_dates()

    # Log distinct dates in DB for diagnostics (first 10 only for logging)
    dates_result = await db.execute(
        select(CampaignMetric.date).distinct().order_by(CampaignMetric.date).limit(10)
    )
    sample_dates = [r[0].strftime("%Y-%m-%d") for r in dates_result.all()]

    # True min/max and count across ALL rows (unfiltered)
    range_result = await db.execute(
        select(
            func.min(CampaignMetric.date).label("earliest"),
            func.max(CampaignMetric.date).label("latest"),
            func.count(func.distinct(cast(CampaignMetric.date, Date))).label("cnt"),
        )
    )
    range_row = range_result.one()
    earliest_date = range_row.earliest.strftime("%Y-%m-%d") if range_row.earliest else None
    latest_date   = range_row.latest.strftime("%Y-%m-%d")   if range_row.latest   else None
    distinct_date_count = int(range_row.cnt or 0)

    logger.info(
        "Kampaign.ai | Analytics: DB date range %s → %s (%d distinct days); sample: %s",
        earliest_date, latest_date, distinct_date_count, sample_dates,
    )

    stmt = _apply_date_filter(
        select(
            func.sum(CampaignMetric.spend).label("total_spend"),
            func.sum(CampaignMetric.spend * CampaignMetric.roas).label("total_revenue"),
            func.avg(CampaignMetric.roas).label("avg_roas"),
            func.avg(CampaignMetric.ctr).label("avg_ctr"),
            func.sum(CampaignMetric.conversions).label("total_conversions"),
            func.sum(CampaignMetric.impressions).label("total_impressions"),
            func.min(CampaignMetric.date).label("date_start"),
            func.max(CampaignMetric.date).label("date_end"),
        ),
        start, end,
    )
    result = await db.execute(stmt)
    row = result.one()

    logger.info(
        "Kampaign.ai | Analytics: overview queried (start=%s end=%s)",
        start_date, end_date,
    )
    return {
        "total_spend_inr":     round(row.total_spend    or 0, 2),
        "total_revenue_inr":   round(row.total_revenue  or 0, 2),
        "avg_roas":            round(row.avg_roas       or 0, 2),
        "avg_ctr":             round(row.avg_ctr        or 0, 2),
        "total_conversions":   int(row.total_conversions or 0),
        "total_impressions":   int(row.total_impressions or 0),
        "earliest_date":       earliest_date,
        "latest_date":         latest_date,
        "distinct_date_count": distinct_date_count,
        "date_range": {
            "start": row.date_start.strftime("%Y-%m-%d") if row.date_start else None,
            "end":   row.date_end.strftime("%Y-%m-%d")   if row.date_end   else None,
        },
    }


# ── Endpoint 2: per-campaign summary ─────────────────────────────────────────

@router.get("/campaigns")
async def get_campaigns(
    start_date: Optional[str] = Query(default=None),
    end_date:   Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    start = _parse_date_param(start_date)
    end   = _parse_date_param(end_date)
    if not start and not end:
        start, end = _default_dates()

    agg_stmt = _apply_date_filter(
        select(
            CampaignMetric.campaign_name,
            func.sum(CampaignMetric.spend).label("total_spend"),
            func.sum(CampaignMetric.spend * CampaignMetric.roas).label("total_revenue"),
            func.avg(CampaignMetric.roas).label("avg_roas"),
            func.avg(CampaignMetric.ctr).label("avg_ctr"),
            func.sum(CampaignMetric.conversions).label("total_conversions"),
            func.sum(CampaignMetric.impressions).label("total_impressions"),
        ).group_by(CampaignMetric.campaign_name)
        .order_by(func.avg(CampaignMetric.roas).desc()),
        start, end,
    )
    agg_rows = (await db.execute(agg_stmt)).all()

    detail_stmt = _apply_date_filter(
        select(CampaignMetric).order_by(CampaignMetric.campaign_name, CampaignMetric.date),
        start, end,
    )
    all_rows = (await db.execute(detail_stmt)).scalars().all()
    rows_by_campaign: dict[str, list] = {}
    for r in all_rows:
        rows_by_campaign.setdefault(r.campaign_name, []).append(r)

    out = []
    for row in agg_rows:
        name     = row.campaign_name or "Unknown"
        avg_roas = round(row.avg_roas or 0, 2)
        out.append({
            "campaign_name":      name,
            "total_spend_inr":    round(row.total_spend    or 0, 2),
            "total_revenue_inr":  round(row.total_revenue  or 0, 2),
            "avg_roas":           avg_roas,
            "avg_ctr":            round(row.avg_ctr        or 0, 2),
            "total_conversions":  int(row.total_conversions or 0),
            "total_impressions":  int(row.total_impressions or 0),
            "roas_trend":         _roas_trend(rows_by_campaign.get(name, [])),
            "performance_label":  _perf_label(avg_roas),
        })

    logger.info(
        "Kampaign.ai | Analytics: campaigns queried — %d campaigns (start=%s end=%s)",
        len(out), start_date, end_date,
    )
    return out


# ── Endpoint 3: ROAS trend — daily aggregated ────────────────────────────────

@router.get("/roas-trend")
async def get_roas_trend(
    campaign_name: Optional[str] = Query(default=None),
    start_date:    Optional[str] = Query(default=None),
    end_date:      Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    start = _parse_date_param(start_date)
    end   = _parse_date_param(end_date)
    if not start and not end:
        start, end = _default_dates()

    # Log all distinct dates before filtering
    all_dates_result = await db.execute(
        select(CampaignMetric.date).distinct().order_by(CampaignMetric.date)
    )
    all_distinct = [r[0].strftime("%Y-%m-%d") for r in all_dates_result.all()]
    logger.info(
        "Kampaign.ai | Analytics: roas-trend — all distinct dates in DB (%d): %s",
        len(all_distinct), all_distinct[:15],
    )

    # Aggregate by date::date and campaign_name so we get one point per day
    day_col = cast(CampaignMetric.date, Date).label("day")
    stmt = _apply_date_filter(
        select(
            day_col,
            CampaignMetric.campaign_name,
            func.avg(CampaignMetric.roas).label("avg_roas"),
            func.sum(CampaignMetric.spend).label("total_spend"),
        ).group_by(day_col, CampaignMetric.campaign_name)
        .order_by(day_col, CampaignMetric.campaign_name),
        start, end,
    )

    if campaign_name:
        stmt = stmt.where(CampaignMetric.campaign_name == campaign_name)

    result = await db.execute(stmt)
    rows = result.all()

    # Detect collapsed dates (all same day — data issue)
    row_dates = list({str(r.day) for r in rows})
    dates_collapsed = len(row_dates) <= 1

    logger.info(
        "Kampaign.ai | Analytics: roas-trend — %d day-campaign points, "
        "dates_collapsed=%s, distinct_days=%d",
        len(rows), dates_collapsed, len(row_dates),
    )

    return {
        "dates_collapsed": dates_collapsed,
        "distinct_dates":  sorted(row_dates),
        "rows": [
            {
                "date":          str(r.day),
                "campaign_name": r.campaign_name or "Unknown",
                "roas":          round(r.avg_roas    or 0, 2),
                "spend_inr":     round(r.total_spend or 0, 2),
            }
            for r in rows
        ],
    }


# ── Endpoint 4: spend breakdown by week ──────────────────────────────────────

@router.get("/spend-breakdown")
async def get_spend_breakdown(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CampaignMetric).order_by(CampaignMetric.date)
    )
    rows = result.scalars().all()

    weekly: dict[tuple, dict] = {}
    for r in rows:
        iso = r.date.isocalendar()
        week_key = f"{iso.year}-W{iso.week:02d}"
        key = (week_key, r.campaign_name or "Unknown")
        if key not in weekly:
            weekly[key] = {
                "week":          week_key,
                "campaign_name": r.campaign_name or "Unknown",
                "spend_inr":     0.0,
                "revenue_inr":   0.0,
                "conversions":   0,
            }
        weekly[key]["spend_inr"]   += r.spend or 0
        weekly[key]["revenue_inr"] += (r.spend or 0) * (r.roas or 0)
        weekly[key]["conversions"] += r.conversions or 0

    out = sorted(weekly.values(), key=lambda x: (x["week"], x["campaign_name"]))
    for row in out:
        row["spend_inr"]   = round(row["spend_inr"],   2)
        row["revenue_inr"] = round(row["revenue_inr"], 2)

    logger.info("Kampaign.ai | Analytics: spend-breakdown queried — %d buckets", len(out))
    return out
