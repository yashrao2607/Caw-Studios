# OrderFlow Service Developer Guide

OrderFlow is the core e-commerce order processing microservice responsible for cart checkout, payment tokenization, and asynchronous refund handling.

---

## 1. Quick Start (< 5 Minutes)

### 1.1 Prerequisites Verification
Before running OrderFlow locally, ensure required dependencies are installed:

```bash
python --version   # Requires Python 3.11+
docker --version   # Requires Docker 24.0+
docker compose version
```

### 1.2 Start Local Dependencies
Launch PostgreSQL 15 and Redis 7 in local development containers:
```bash
docker compose up -d postgres redis
```

### 1.3 Configure Environment
Copy the development environment template:
```bash
cp .env.example .env
```
Default `.env` contents:
```env
PORT=8080
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/orderflow
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
AUTH_SERVICE_URL=http://localhost:8001
STRIPE_API_KEY=sk_test_mock_stripe_key
LOG_LEVEL=DEBUG
```

### 1.4 Database Migrations
Run Alembic migrations to set up the local schema:
```bash
alembic upgrade head
```

### 1.5 Run API & Celery Worker
Start the FastAPI server:
```bash
uvicorn orderflow.main:app --host 0.0.0.0 --port 8080 --reload
```

In a separate terminal, start the asynchronous Celery refund worker:
```bash
celery -A orderflow.worker worker --loglevel=info
```

---

## 2. Running Test Suite

Execute unit and integration tests:
```bash
pytest tests/ -v --cov=orderflow
```

---

## 3. Deployment & Rollback

Deploying to staging or production via Helm:
```bash
helm upgrade --install orderflow ./deploy/helm -n production
```

Emergency rollback if deployment causes errors:
```bash
helm rollback orderflow --namespace production
```

---

## 4. Team Contacts & Support

* **On-Call Slack Channel:** `#orderflow-oncall`
* **Data Engineering (Postgres):** `#data-eng`
* **Platform Infrastructure (Kubernetes/Helm):** `#platform-infra`
