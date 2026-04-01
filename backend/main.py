# Kampaign.ai — AI-native campaign engine
# FastAPI application entry point

# load_dotenv() MUST run before any service imports so os.getenv() works everywhere
from dotenv import load_dotenv
load_dotenv()

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import engine, Base
from routers import campaigns, creatives, insights, sheets, actions, chat, strategy

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("kampaign")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Kampaign.ai | Starting up — AI-native campaign engine")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    logger.info("Kampaign.ai | Shutting down")
    await engine.dispose()


app = FastAPI(
    title="Kampaign.ai API",
    description="AI-native campaign engine — backend API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
app.include_router(creatives.router, prefix="/api/creatives", tags=["creatives"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(sheets.router,  prefix="/api/sheets",  tags=["sheets"])
app.include_router(actions.router, prefix="/api/actions", tags=["actions"])
app.include_router(chat.router,     prefix="/api/chat",     tags=["chat"])
app.include_router(strategy.router, prefix="/api/strategy", tags=["strategy"])


@app.get("/")
async def root():
    return {
        "product": "Kampaign.ai",
        "tagline": "AI-native campaign engine",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
