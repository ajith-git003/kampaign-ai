# Kampaign.ai — AI-native campaign engine
# Sheets router — ingest campaign data from Google Sheets (no body required)

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import text
from database import get_db
from models import CampaignMetric
from services.sheets_service import fetch_and_map_sheet, list_sheet_tabs

router = APIRouter()
logger = logging.getLogger("kampaign.sheets")


@router.get("/tabs")
async def get_sheet_tabs():
    """Debug endpoint — lists all worksheet tab names in the configured Google Sheet."""
    try:
        tabs = await list_sheet_tabs()
        return {"spreadsheet_id": __import__('config').settings.google_sheet_id, "tabs": tabs}
    except FileNotFoundError as exc:
        return {"status": "error", "message": str(exc)}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/sample")
async def sample_metrics(db: AsyncSession = Depends(get_db)):
    """
    Diagnostic endpoint — returns 5 raw rows from campaign_metrics
    so you can verify exact column names, date values, and numeric values.
    Also returns total row count and min/max date in the table.
    """
    try:
        # Total count
        count_result = await db.execute(text("SELECT COUNT(*) FROM campaign_metrics"))
        total = count_result.scalar()

        # Min / max date
        range_result = await db.execute(
            text("SELECT MIN(date), MAX(date) FROM campaign_metrics")
        )
        date_range = range_result.one()

        # 5 sample rows — raw SQL so we see exact stored values
        rows_result = await db.execute(
            text("""
                SELECT id, date, impressions, clicks, spend,
                       conversions, ctr, cpc, roas, raw_data
                FROM campaign_metrics
                ORDER BY date DESC
                LIMIT 5
            """)
        )
        rows = rows_result.mappings().all()

        return {
            "total_rows": total,
            "date_min":   str(date_range[0]),
            "date_max":   str(date_range[1]),
            "sample_rows": [dict(r) for r in rows],
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.post("/ingest")
async def ingest_from_sheet(db: AsyncSession = Depends(get_db)):
    """
    Pull data from the Google Sheet configured in .env and persist
    each row as a CampaignMetric.

    No request body needed — reads everything from environment variables:
      GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME, GOOGLE_SERVICE_ACCOUNT_JSON
    """
    try:
        rows = await fetch_and_map_sheet()

        if not rows:
            return {
                "status": "error",
                "message": "Sheet returned 0 rows — check sheet ID and worksheet name",
            }

        # ── STEP 1: Diagnostic logging — parsed rows ──────────────────────────
        logger.info("Kampaign.ai | Sheets: parsed %d rows from sheet", len(rows))
        for i, sample in enumerate(rows[:3]):
            logger.info(
                "Kampaign.ai | Sheets: sample row[%d] campaign_name=%r date=%s spend=%s roas=%s",
                i,
                sample.get("campaign_name"),
                sample.get("date"),
                sample.get("spend"),
                sample.get("roas"),
            )

        # ── STEP 3: Log model columns ─────────────────────────────────────────
        cols = [c.name for c in CampaignMetric.__table__.columns]
        logger.info("Kampaign.ai | CampaignMetric columns: %s", cols)

        # ── STEP 4: Insert rows with per-row error handling ───────────────────
        saved = 0
        failed = 0
        for idx, row in enumerate(rows):
            try:
                metric = CampaignMetric(
                    campaign_id=None,
                    campaign_name=row.get("campaign_name"),   # FIX: was missing
                    date=row["date"],
                    impressions=row["impressions"],
                    clicks=row["clicks"],
                    spend=row["spend"],
                    conversions=row["conversions"],
                    ctr=row["ctr"],
                    cpc=row["cpc"],
                    roas=row["roas"],
                    raw_data=row["raw_data"],
                )
                db.add(metric)
                saved += 1
            except Exception as row_exc:
                failed += 1
                logger.error(
                    "Kampaign.ai | Sheets: row %d failed — %s | row=%r",
                    idx, row_exc, row,
                )

        # ── STEP 4 cont: Commit all rows to the database ──────────────────────
        await db.commit()   # FIX: was missing — rows were never persisted

        logger.info(
            "Kampaign.ai | Sheets: saved %d rows successfully, %d failed",
            saved, failed,
        )

        return {
            "status":      "success",
            "rows_synced": saved,
            "rows_failed": failed,
            "message":     f"Kampaign.ai | Sheets sync complete — {saved} rows saved",
        }

    except FileNotFoundError as exc:
        logger.error("Kampaign.ai | %s", exc)
        return {"status": "error", "message": str(exc)}

    except Exception as exc:
        logger.error("Kampaign.ai | Sheets ingest failed: %s", exc)
        return {"status": "error", "message": str(exc)}
