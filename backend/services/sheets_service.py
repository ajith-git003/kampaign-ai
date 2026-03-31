# Kampaign.ai — AI-native campaign engine
# Google Sheets ingestion service (gspread + google-auth)

import os
import logging
from datetime import datetime
from typing import Any

from config import settings

logger = logging.getLogger("kampaign.sheets")

# ── Column mapping: Google Sheet header → DB field ────────────────────────────
# Columns not listed here are stored in raw_data as-is.
COLUMN_TO_DB = {
    "Campaign Name":           "campaign_name",
    "Date":                    "date",
    "Amount Spent":            "spend",
    "Impressions":             "impressions",
    "Link Click":              "clicks",
    "CPC":                     "cpc",
    "CTR":                     "ctr",
    "Purchases":               "conversions",
    "ROAS":                    "roas",
}

# DB fields that are stored as int
INT_FIELDS = {"impressions", "clicks", "conversions"}


def _clean(val: Any, field: str) -> Any:
    """Strip currency / percent symbols, convert to float or int, treat empty as 0."""
    if isinstance(val, str):
        val = val.replace("₹", "").replace("%", "").replace(",", "").strip()
        if val in ("", "-", "N/A"):
            val = "0"
    try:
        return int(float(val)) if field in INT_FIELDS else float(val)
    except (ValueError, TypeError):
        return 0


def _parse_date(val: Any) -> datetime:
    """
    Parse dates from the sheet. Handles:
      - "April 1", "May 15"  (no year — current year is appended)
      - "01/04/2025", "2025-04-01", "01-04-2025", "01 Apr 2025"
    Falls back to utcnow if nothing matches.
    """
    if isinstance(val, datetime):
        return val

    raw = str(val).strip()

    # "April 1" / "May 15" — month-name + day, no year
    try:
        date_str = f"{raw} {datetime.now().year}"
        return datetime.strptime(date_str, "%B %d %Y")
    except ValueError:
        pass

    # Standard formats with full year
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d %b %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue

    logger.warning("Kampaign.ai | Could not parse date '%s', using utcnow", raw)
    return datetime.utcnow()


def _resolve_creds_path() -> str:
    """
    Resolve credentials path — tries the configured path first, then
    checks one level up (project root) as a fallback.
    Logs every candidate so you can verify in the terminal.
    """
    raw = settings.google_service_account_json
    candidates = [
        os.path.abspath(raw),                                        # as-is relative to CWD
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", os.path.basename(raw))),  # project root
    ]
    for path in candidates:
        logger.info("Kampaign.ai | Trying credentials path: %s — exists=%s", path, os.path.exists(path))
        if os.path.exists(path):
            logger.info("Kampaign.ai | Using credentials: %s", path)
            return path
    raise FileNotFoundError(
        f"Kampaign.ai | credentials.json not found. Tried:\n" + "\n".join(candidates)
    )


def _get_client():
    """Authenticate with the service account and return a gspread client."""
    import gspread
    from google.oauth2.service_account import Credentials

    creds_path = _resolve_creds_path()
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
    ]
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    logger.info("Kampaign.ai | Google credentials loaded OK")
    return gspread.authorize(creds)


async def list_sheet_tabs() -> list[str]:
    """Return all worksheet tab names for the configured spreadsheet."""
    client = _get_client()
    spreadsheet = client.open_by_key(settings.google_sheet_id)
    tabs = [ws.title for ws in spreadsheet.worksheets()]
    logger.info("Kampaign.ai | Tabs found: %s", tabs)
    return tabs


async def fetch_and_map_sheet() -> list[dict[str, Any]]:
    """
    Fetch all rows from the configured Google Sheet, map column headers to
    DB field names, clean values, and return a list of row dicts ready for
    CampaignMetric insertion.

    Reads from env:
      GOOGLE_SHEET_ID        — spreadsheet document ID
      GOOGLE_SHEET_NAME      — worksheet tab name
      GOOGLE_SERVICE_ACCOUNT_JSON — path to service account key file
    """
    sheet_id   = settings.google_sheet_id
    sheet_name = settings.google_sheet_name

    logger.info(
        "Kampaign.ai | Fetching sheet id=%s worksheet='%s'", sheet_id, sheet_name
    )

    client    = _get_client()
    spreadsheet = client.open_by_key(sheet_id)
    worksheet = spreadsheet.worksheet(sheet_name)
    raw_rows  = worksheet.get_all_records()   # list[dict] — headers as keys

    logger.info("Kampaign.ai | Raw rows fetched from sheet: %d", len(raw_rows))

    mapped = []
    for raw in raw_rows:
        row: dict[str, Any] = {"raw_data": {}}

        for header, value in raw.items():
            db_field = COLUMN_TO_DB.get(header)
            if db_field == "date":
                row["date"] = _parse_date(value)
            elif db_field == "campaign_name":
                row["campaign_name"] = str(value).strip() if value else None
            elif db_field:
                row[db_field] = _clean(value, db_field)
            else:
                # Everything else lands in raw_data for future use
                row["raw_data"][header] = value

        # Guarantee all DB fields have a default if missing from the sheet
        row.setdefault("campaign_name", None)
        row.setdefault("date",          datetime.utcnow())
        row.setdefault("spend",         0.0)
        row.setdefault("impressions",   0)
        row.setdefault("clicks",        0)
        row.setdefault("cpc",           0.0)
        row.setdefault("ctr",           0.0)
        row.setdefault("conversions",   0)
        row.setdefault("roas",          0.0)

        mapped.append(row)

    return mapped
