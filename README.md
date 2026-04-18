# Kampaign.ai

**AI-native Facebook Ads campaign engine**

Kampaign.ai is a production-ready agentic AI platform 
that detects underperforming Facebook campaigns, generates 
actionable recommendations, and executes real optimizations 
via the Facebook Marketing API — with human-in-the-loop approval.

![Dashboard Preview](https://img.shields.io/badge/Status-Live-green)
![Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20OpenAI-blue)

---

## What it does
```
Google Sheets data → Anomaly Detection → GPT-4o-mini Insights
       ↓                                        ↓
  PostgreSQL                           Action Recommendations
       ↓                                        ↓
  Analytics Dashboard          Execute on Facebook Marketing API
                                                ↓
                                    Verify + Confirm in real time
```

---

## Features

### AI Recommendations Engine
- Detects underperforming campaigns using Z-score 
  anomaly detection across 180 days of metrics
- Generates structured recommendations via GPT-4o-mini
- Executes real actions on Facebook Marketing API:
  - Pause campaigns
  - Reduce budget (with ₹100 minimum guard)
  - Increase budget
- Verifies every action by re-fetching live status 
  from Facebook after execution
- Human-in-the-loop: users can suggest alternatives 
  and the AI reconsiders in real time

### Conversational Campaign Intelligence
- Floating chat panel on the dashboard
- Ask questions in plain English:
  "Why is Video Views underperforming?"
  "Which campaign should I scale?"
- AI reads live campaign data from the database 
  and responds with exact numbers and citations
- Campaign-specific context via dropdown filter

### AI Strategy Builder
- Input: niche, product, budget, objective, audience
- Output: complete TOF/MOF/BOF funnel strategy with:
  - Audience definition per funnel stage
  - Budget allocation and KPI benchmarks
  - 90-day revenue projection
  - Tools required checklist
  - Step-by-step launch checklist

### Creative Audit (Vision AI)
- Upload image or video ad creative
- GPT-4o Vision analyzes against 8 criteria:
  Hook strength, Value proposition, CTA clarity,
  Text overlay, Brand visibility, Emotional trigger,
  Mobile optimization, Visual quality
- Returns score 0-100, grade A-F, strengths, 
  improvements, and Facebook policy flags

### Analytics Dashboard
- ROAS trend line chart (7/30/90 day / custom range)
- Spend vs Revenue bar chart per campaign
- Campaign performance table with status badges:
  Top Performer / Average / Underperforming
- Top 3 vs Bottom 3 campaign comparison
- CTR comparison with account average reference line
- Custom date range picker

### Ad Copy Generator
- GPT-4o-mini generates multiple copy variants
- Configurable tone, target audience, variant count
- Similarity scoring via sentence-transformers

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Python 3.11 + FastAPI |
| AI — Insights + Chat + Strategy | OpenAI GPT-4o-mini |
| AI — Creative Audit | OpenAI GPT-4o Vision |
| Ad scoring | sentence-transformers (all-MiniLM-L6-v2) |
| Anomaly detection | Z-score (scikit-learn) |
| Ad platform | Meta Marketing API (facebook-business SDK) |
| Data ingestion | Google Sheets via gspread + google-auth |
| Database | PostgreSQL on Supabase (SQLAlchemy async) |
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |
| Image processing | Pillow |

---

## Project Structure
```
kampaign-ai/
  backend/
    main.py
    config.py
    database.py
    models.py
    routers/
      campaigns.py      # Campaign CRUD + Facebook launch
      creatives.py      # Copy generation + creative audit
      insights.py       # AI insights + regenerate action
      sheets.py         # Google Sheets ingestion
      actions.py        # Facebook action execution
      analytics.py      # Performance analytics endpoints
      strategy.py       # AI strategy builder
      chat.py           # Conversational intelligence
    services/
      facebook_service.py    # Meta Marketing API wrapper
      facebook_actions.py    # Pause / budget / activate
      sheets_service.py      # gspread ingestion
      ai_service.py          # GPT insights + actions
      scoring_service.py     # sentence-transformers
      anomaly_service.py     # Z-score detection
    migrations/
      migration_001.sql
      migration_002.sql
    requirements.txt
    .env.example
    Dockerfile
  frontend/
    src/
      App.jsx
      ThemeContext.jsx       # Dark/light mode
      theme.js
      pages/
        Dashboard.jsx
        Analytics.jsx
        Strategy.jsx
        Creatives.jsx
      components/
        Sidebar.jsx
        ActionCard.jsx        # Execute/Suggest/Dismiss
        ChatPanel.jsx         # Conversational AI
        InsightCard.jsx
        CampaignTable.jsx
        Toast.jsx
    index.html
    package.json
  docker-compose.yml
  README.md
```

---

## Quick Start

### 1. Clone and configure
```bash
git clone https://github.com/ajith-git003/kampaign-ai.git
cd kampaign-ai
cp backend/.env.example backend/.env
# Fill in all required API keys (see below)
```

### 2. Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API runs at: `http://localhost:8000`
Swagger docs: `http://localhost:8000/docs`

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

### 4. Database setup

Run migrations in Supabase SQL Editor:
```sql
-- migration_001.sql
ALTER TABLE campaign_metrics
  ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255);
ALTER TABLE campaign_metrics
  DROP CONSTRAINT IF EXISTS campaign_metrics_campaign_id_fkey;
ALTER TABLE campaign_metrics
  ALTER COLUMN campaign_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS campaign_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name VARCHAR(255) NOT NULL UNIQUE,
    fb_campaign_id VARCHAR(100),
    fb_adset_id VARCHAR(100),
    fb_status VARCHAR(50),
    synced_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type VARCHAR(100) NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    fb_campaign_id VARCHAR(100),
    details JSONB,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    result JSONB,
    executed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- migration_002.sql
ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS actions_json JSONB;
```

### 5. First run sequence

In Swagger (`/docs`), run in this order:
```
1. POST /api/sheets/ingest        → sync campaign data
2. POST /api/actions/sync-facebook → match campaigns to FB IDs
3. POST /api/insights/generate    → generate AI recommendations
```

---

## API Endpoints

### Campaigns
| Method | Path | Description |
|---|---|---|
| GET | `/api/campaigns/` | List all campaigns |
| POST | `/api/campaigns/` | Create campaign |
| DELETE | `/api/campaigns/{id}` | Delete campaign |

### Actions (Facebook)
| Method | Path | Description |
|---|---|---|
| POST | `/api/actions/sync-facebook` | Sync campaigns from Facebook |
| POST | `/api/actions/execute` | Execute action on Facebook |
| POST | `/api/actions/dismiss` | Dismiss recommendation |
| GET | `/api/actions/history` | Last 20 executed actions |

### Insights
| Method | Path | Description |
|---|---|---|
| POST | `/api/insights/generate` | Run full AI pipeline |
| GET | `/api/insights/latest` | Get latest insight + actions |
| POST | `/api/insights/regenerate-action` | Human-in-the-loop feedback |

### Analytics
| Method | Path | Description |
|---|---|---|
| GET | `/api/analytics/overview` | Account-level KPIs |
| GET | `/api/analytics/campaigns` | Per-campaign summary |
| GET | `/api/analytics/roas-trend` | Daily ROAS time series |
| GET | `/api/analytics/spend-breakdown` | Weekly spend by campaign |

### Other
| Method | Path | Description |
|---|---|---|
| POST | `/api/sheets/ingest` | Ingest Google Sheets data |
| POST | `/api/creatives/generate` | Generate ad copy |
| POST | `/api/creatives/audit` | Vision AI creative audit |
| POST | `/api/strategy/generate` | AI strategy builder |
| POST | `/api/chat/ask` | Conversational intelligence |

---

## Required API Keys

| Key | Where to get |
|---|---|
| `OPENAI_API_KEY` | platform.openai.com/api-keys |
| `META_APP_ID` | developers.facebook.com/apps |
| `META_APP_SECRET` | developers.facebook.com/apps |
| `META_ACCESS_TOKEN` | Meta Business Manager → System Users |
| `META_AD_ACCOUNT_ID` | Ads Manager URL (act_XXXXXXXXXX) |
| `META_PAGE_ID` | Facebook Page settings |
| `DATABASE_URL` | Supabase → Settings → Database |
| `GOOGLE_SHEET_ID` | Google Sheets URL |
| `GOOGLE_SHEET_NAME` | Tab name in your sheet |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud → IAM → Service Accounts |

---

## Environment Variables
```bash
# App
DEBUG=false
CORS_ORIGINS=["http://localhost:5173"]

# OpenAI
OPENAI_API_KEY=sk-...

# Meta Marketing API
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=act_
META_PAGE_ID=

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_JSON=./credentials.json
GOOGLE_SHEET_ID=
GOOGLE_SHEET_NAME=

# Database
DATABASE_URL=postgresql+asyncpg://...
```

---

## AI Pipeline
```
Google Sheets
      │
      ▼
campaign_metrics (PostgreSQL)
      │
      ▼
Z-score Anomaly Detection
  per campaign × last 14 days vs all-time
      │
      ▼
GPT-4o-mini (Insights)
  → insight_text (structured [ROAS][CTR][Spend])
  → actions_json (3 actions: pause/reduce/increase)
      │
      ▼
Dashboard Action Cards
      │
   Execute
      │
      ▼
Facebook Marketing API
  → pause_campaign()
  → reduce_campaign_budget()
  → increase_campaign_budget()
      │
      ▼
verify_campaign_status()
  → re-fetch live status from Facebook
      │
      ▼
action_log (PostgreSQL)
```

---

## Author

**Ajith Kumar**
Performance Marketer → AI Engineer
GitHub: github.com/ajith-git003

---

*Kampaign.ai — AI-native campaign engine*
