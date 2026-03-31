# Kampaign.ai — AI-native campaign engine
# Backend Dockerfile — Python 3.11 + FastAPI

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required by psycopg2-binary and sentence-transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Default: run FastAPI with Uvicorn
# Override CMD in docker-compose for the Celery worker / beat services
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
