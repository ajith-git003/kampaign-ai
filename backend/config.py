# Kampaign.ai — AI-native campaign engine
# Centralised settings via pydantic-settings

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    app_name: str = "Kampaign.ai"
    debug: bool = False

    # Database — Supabase PostgreSQL (asyncpg driver)
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/kampaign"

    # OpenAI — GPT-4o-mini powers all AI features in Kampaign.ai
    # [REQUIRED] Get your key at: https://platform.openai.com/api-keys
    openai_api_key: str = ""

    # Meta Marketing API
    # [REQUIRED] Create an app at: https://developers.facebook.com
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_access_token: str = ""       # Long-lived user / system-user token
    meta_ad_account_id: str = ""      # Format: act_XXXXXXXXXX

    # Google Sheets — path to service account JSON key file
    # [REQUIRED] Create at: https://console.cloud.google.com/iam-admin/serviceaccounts
    google_service_account_json: str = "../credentials.json"
    google_sheet_id: str = ""        # Google Sheets document ID
    google_sheet_name: str = "Sheet1"  # Worksheet tab name

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"

    # CORS — add your frontend origin here
    cors_origins: List[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
