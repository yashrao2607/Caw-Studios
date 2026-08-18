# Service Overview & Operational Runbook Manual

## 1. Purpose
High-performance distributed URL shortening, redirection, and analytics microservice. Accepts target URLs to issue low-latency short aliases while recording real-time geolocation click metrics with circuit-breaker-protected graceful degradation.

---

## 2. Dependencies & Operational Fallbacks

| Dependency | Type | What Happens Without It | Graceful Degradation & Fallback Strategy (Module 06) |
| :--- | :--- | :--- | :--- |
| **PostgreSQL 16** | Primary Datastore | Complete write failure; read queries fail if cache misses. | Health probe `/ready` turns `503`. Circuit breaker sheds un-cached writes; cached short links remain served from Redis. |
| **Redis 7** | Distributed Cache | Latency increases by ~15-25ms as all traffic hits PostgreSQL. | Circuit breaker opens on Redis timeout; fallback directly passes read queries to primary DB read-replica without dropping requests. |
| **External Geocoding API** | External HTTP | Analytics geolocation resolution fails. | Circuit breaker trips after 3 timeouts; click stream falls back to logging country as `"UNKNOWN"` and queues background reconciliation. |

---

## 3. Endpoints & Health Probes

* `GET /live`: Liveness probe. Returns HTTP 200 `{"status":"live","uptime":1842}` if the Node.js event loop is responsive.
* `GET /ready`: Readiness probe. Evaluates live TCP ping against PostgreSQL and Redis. Returns HTTP 200 `{"status":"ready","database":"ok","redis":"ok"}` or HTTP 503 if downstream DB connection pool is severed.
* `GET /metrics`: Prometheus scraper endpoint exporting latency histograms, error counters, and connection pool gauges.
* `POST /api/links`: Shortens a destination URL (rate-limited, authenticated).
* `GET /:shortCode`: Resolves 302 redirect with Redis caching.
* `GET /api/links/:shortCode/analytics`: Aggregated click analytics query.

---

## 4. Operational Configuration (.env.production)

| Environment Variable | Default Value | Runtime Modifiable? | Operational Impact & Safety Rule |
| :--- | :--- | :--- | :--- |
| `DB_POOL_MAX` | `20` | Restart Required | Max connections allocated to PostgreSQL pool. |
| `DB_TIMEOUT_MS` | `3000` | Restart Required | Query timeout before releasing connection back to pool. |
| `CIRCUIT_BREAKER_THRESHOLD` | `5` | Restart Required | Consecutive failures before opening breaker to degraded mode. |
| `CIRCUIT_BREAKER_RESET_MS` | `15000` | Restart Required | Half-open timeout before re-attempting upstream health check. |
| `LOG_LEVEL` | `info` | Dynamic / Signal | Logging verbosity (`debug`, `info`, `warn`, `error`). Send `SIGUSR2` to toggle debug. |

---

## 5. Deployment Commands (Zero Downtime)

```bash
# Automated CI/CD triggers on push to main.
# Manual deployment trigger:
git push origin main

# Verify deployment health immediately:
curl -f http://127.0.0.1:3000/live
# Expected: {"status":"live"}

curl -f http://127.0.0.1:3000/ready
# Expected: {"status":"ready","database":"ok","redis":"ok"}
```

---

## 6. Rollback Commands (Immediate Triage)

```bash
# Instant Rollback to previous Docker image:
docker service update --rollback url-shortener_api

# Or via Git release rollback:
git checkout tags/v1.4.1 && docker build -t url-shortener:v1.4.1 . && docker restart api-prod

# Verify rollback status:
curl -f http://127.0.0.1:3000/ready
```

---

## 7. Ownership & Escalation Hierarchy

* **Service Owner:** Core Platform Infrastructure & Edge Routing Team (`#team-platform-oncall`).
* **Primary On-Call:** Page via PagerDuty Schedule `url-shortener-primary` (Slack: `@oncall-primary`).
* **Secondary Escalation:** Staff Site Reliability Engineer (`@sre-escalation`).
* **Engineering Manager:** EM Core Platform (`@em-core-platform`).
* **SLA Threshold:** If primary on-call does not acknowledge alert within 5 minutes, PagerDuty automatically pages secondary escalation and triggers executive status bridge.
