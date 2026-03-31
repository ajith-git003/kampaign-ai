# Kampaign.ai

**AI-native campaign engine**

A full-stack AI marketing platform that connects Meta ads, Google Sheets data, and OpenAI GPT-4o-mini to give performance marketers automated insights, anomaly detection, and AI-generated ad copy.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Python 3.11 + FastAPI |
| AI | OpenAI GPT-4o-mini (copy + insights) |
| Ad scoring | sentence-transformers (`all-MiniLM-L6-v2`) |
| Anomaly detection | scikit-learn Isolation Forest |
| Ad platform | Meta Marketing API (facebook-business SDK) |
| Data ingestion | Google Sheets via gspread + google-auth |
| Database | PostgreSQL (Supabase) via SQLAlchemy async + asyncpg |
| Task queue | Celery + Redis |
| Frontend | React 18 + Vite + Tailwind CSS |

---

## Project Structure

```
kampaign-ai/
  backend/
    main.py              # FastAPI app — title: "Kampaign.ai API"
    config.py            # pydantic-settings — all env vars
    database.py          # async SQLAlchemy engine + session
    models.py            # ORM: Campaign, Creative, CampaignMetric, Insight
    routers/
      campaigns.py       # CRUD for campaigns
      creatives.py       # GPT-4o-mini copy generation + scoring
      insights.py        # Anomaly check + insight feed
      sheets.py          # Google Sheets ingestion
    services/
      facebook_service.py   # Meta Marketing API wrapper
      sheets_service.py     # gspread ingestion
      ai_service.py         # OpenAI GPT-4o-mini (copy + summaries)
      scoring_service.py    # sentence-transformers quality score
      anomaly_service.py    # Isolation Forest anomaly detection
    tasks/
      celery_app.py      # Celery factory + beat schedule
      daily_tasks.py     # Daily sync pipeline
    requirements.txt
    .env.example
    Dockerfile
  frontend/
    src/
      App.jsx            # Router + nav
      pages/
        Dashboard.jsx    # KPI strip + campaign table + insights feed
        Creatives.jsx    # GPT-4o-mini copy generator UI
        Launch.jsx       # Create campaign form
      components/
        InsightCard.jsx
        MetricCard.jsx
        CampaignTable.jsx
    index.html
    package.json
    vite.config.js
    tailwind.config.js
  docker-compose.yml
```

---

## Quick Start

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
# Fill in: DATABASE_URL, OPENAI_API_KEY, META_*, GOOGLE_SERVICE_ACCOUNT_JSON
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| API (FastAPI) | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Frontend (React) | http://localhost:5173 |

### 3. Run locally (without Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

**Celery worker + beat (separate terminals):**
```bash
celery -A tasks.celery_app worker --loglevel=info
celery -A tasks.celery_app beat --loglevel=info
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/campaigns/` | List all campaigns |
| POST | `/api/campaigns/` | Create campaign |
| GET | `/api/campaigns/{id}` | Get campaign |
| DELETE | `/api/campaigns/{id}` | Delete campaign |
| GET | `/api/creatives/` | List creatives |
| POST | `/api/creatives/generate` | Generate + score copy with GPT-4o-mini |
| GET | `/api/insights/` | List insights |
| POST | `/api/insights/run-anomaly-check/{id}` | Run Isolation Forest on campaign |
| POST | `/api/insights/{id}/acknowledge` | Acknowledge insight |
| POST | `/api/sheets/ingest` | Ingest metrics from Google Sheet |

---

## AI Pipeline

```
Meta API ──► CampaignMetric rows
                    │
                    ▼
         Isolation Forest (scikit-learn)
                    │ anomaly flags
                    ▼
         GPT-4o-mini (OpenAI)
                    │ insight summary
                    ▼
              Insight row → UI feed
```

Copy generation:
```
User prompt ──► GPT-4o-mini ──► variants
                                    │
                          sentence-transformers
                                    │ cosine similarity score
                                    ▼
                           Creative row saved
```

---

## Required API Keys

| Key | Where to get it |
|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `META_APP_ID` / `META_APP_SECRET` | https://developers.facebook.com/apps |
| `META_ACCESS_TOKEN` | Meta Business Manager → System Users |
| `META_AD_ACCOUNT_ID` | Meta Ads Manager URL (`act_XXXXXXXXXX`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud Console → IAM → Service Accounts |

---

*Kampaign.ai — AI-native campaign engine*
