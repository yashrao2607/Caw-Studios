# Incident Runbooks: Top 3 Critical Failure Modes

---

## Runbook 1: Database Connection Pool Exhaustion / Database Unreachable

### Alert / Detection
* **Alert Name:** `DB_CONNECTION_POOL_EXHAUSTED` / `PG_CONNECTION_TIMEOUT`
* **Symptoms:** HTTP 503 Service Unavailable on `POST /api/links`, `/ready` endpoint returns `{"status":"degraded","database":"timeout"}`, Prometheus gauge `db_pool_waiting_requests > 10`.
* **Primary Signal:** Log entry `Error: Connection pool exhausted (20/20 active connections in use for > 3000ms)`.

### Diagnosis Steps
**Step 1: Check Database Readiness Probe**
```bash
curl -i http://127.0.0.1:3000/ready
```
* *If Problem Present:* Output shows `HTTP/1.1 503 Service Unavailable` with `{"status":"degraded","database":"error: timeout"}`.
* *If Healthy:* Output shows `HTTP/1.1 200 OK` with `{"status":"ready","database":"ok","redis":"ok"}`.

**Step 2: Inspect Active PostgreSQL Connections & Slow Locks**
```bash
docker exec -i postgres psql -U postgres -d shortener -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```
* *If Problem Present:* `active` connections equal max pool limit (e.g., `20`), or idle in transaction locks exist.
* *If Healthy:* Count of `active` connections is `< 5`.

### Fix Actions (Linear Recovery)
**Step 1: Terminate Stalled Long-Running Transactions**
```bash
docker exec -i postgres psql -U postgres -d shortener -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < current_timestamp - INTERVAL '15 seconds';"
```
* *Expected Output:* Number of terminated connections (e.g., `pg_terminate_backend: t`).

**Step 2: Gracefully Restart Application API Container to Re-initialize Pool**
```bash
docker restart api-prod
```
* *Expected Output:* `api-prod`.

### Verification
```bash
curl -f http://127.0.0.1:3000/ready
```
* *Expected Output:* `{"status":"ready","database":"ok","redis":"ok"}` with HTTP 200.
* *Wait 2 minutes and repeat:* Assert zero HTTP 503 responses over 100 consecutive probe pings.

### Escalation Policy
If unresolved in 5 minutes:
1. Post incident summary in `#ops-incidents` with DB connection dump.
2. Page Staff Database Administrator (`@dba-oncall`) via PagerDuty.

---

## Runbook 2: High 5xx Error Rate Spike (> 5% Error Budget Burn)

### Alert / Detection
* **Alert Name:** `HIGH_ERROR_RATE_5XX`
* **Symptoms:** HTTP 500 Internal Server Error rate exceeds 5% over 2-minute rolling window; PagerDuty Sev-1 page triggered.
* **Primary Signal:** CloudWatch / Datadog alert `sum(rate(http_requests_total{status=~"5.."}[2m])) / sum(rate(http_requests_total[2m])) > 0.05`.

### Diagnosis Steps
**Step 1: Query Error Logs for Stack Trace Signatures**
```bash
docker logs --tail 50 api-prod 2>&1 | grep '"level":"error"'
```
* *If Problem Present:* Stack trace shows recurring unhandled exception (e.g., `TypeError: Cannot read properties of undefined (reading 'headers')`).
* *If Healthy:* No error log entries returned.

**Step 2: Identify Timestamp of Last Code / Config Deployment**
```bash
docker inspect --format='{{.Created}}' api-prod
```
* *If Problem Present:* Deployment timestamp correlates with the sudden spike in 5xx errors (< 10 minutes ago).

### Fix Actions (Linear Recovery)
**Step 1: Execute Immediate Zero-Downtime Rollback to Previous Stable Tag**
```bash
docker service update --rollback url-shortener_api
```
* *Expected Output:* `url-shortener_api updated` with green health status.

**Step 2: Invalidate Staged Cache Keys**
```bash
docker exec -i redis redis-cli -a $REDIS_PASSWORD EVAL "return redis.call('del', unpack(redis.call('keys', 'link:*')))" 0
```
* *Expected Output:* Number of flushed keys.

### Verification
```bash
curl -i http://127.0.0.1:3000/metrics | grep 'http_requests_total{status="500"}'
```
* *Expected Output:* 5xx counter stops incrementing; error rate drops back to 0.0%.

### Escalation Policy
If error rate remains elevated after rollback:
1. Page Technical Lead (`@tech-lead-edge`) immediately.
2. Activate Cloudflare static maintenance fallback page.

---

## Runbook 3: Circuit Breaker Open / Geocoding Dependency Outage

### Alert / Detection
* **Alert Name:** `DEPENDENCY_CIRCUIT_BREAKER_OPEN`
* **Symptoms:** External geocoding requests timing out; analytics reporting `"location":"UNKNOWN"`; circuit breaker state gauge equals `1` (`OPEN`).
* **Primary Signal:** Metrics output `circuit_breaker_state{name="geocoding"} 1`.

### Diagnosis Steps
**Step 1: Inspect Circuit Breaker Prometheus Metric**
```bash
curl -s http://127.0.0.1:3000/metrics | grep 'circuit_breaker_state'
```
* *If Problem Present:* `circuit_breaker_state{name="geocoding"} 1` (Circuit is OPEN).
* *If Healthy:* `circuit_breaker_state{name="geocoding"} 0` (Circuit is CLOSED).

**Step 2: Test Direct Connectivity to Upstream Geocoding Provider**
```bash
curl -I --max-time 2 https://api.ipstack.com/check?access_key=$GEO_KEY
```
* *If Problem Present:* Connection times out (`curl: (28) Operation timed out`) or returns 502/503.
* *If Healthy:* HTTP 200 OK returned within 150ms.

### Fix Actions (Linear Recovery)
**Step 1: Confirm Graceful Fallback Mode Is Active (No User Dropped Requests)**
```bash
curl -X POST http://127.0.0.1:3000/api/links -H "Content-Type: application/json" -d '{"url":"https://example.com"}'
```
* *Expected Output:* HTTP 201 Created with short link returned immediately (graceful fallback working).

**Step 2: Switch to Secondary Geocoding Provider via Dynamic Signal**
```bash
docker exec -i api-prod sh -c "export GEO_PROVIDER=backup_maxmind && kill -USR2 1"
```
* *Expected Output:* Process logs `Switched geocoding provider to backup_maxmind; circuit breaker reset to HALF_OPEN`.

### Verification
```bash
curl -s http://127.0.0.1:3000/metrics | grep 'circuit_breaker_state'
```
* *Expected Output:* `circuit_breaker_state{name="geocoding"} 0` (Closed, healthy).

### Escalation Policy
If backup provider also fails and degraded mode duration exceeds 2 hours:
1. Notify Data Engineering on Slack `#data-analytics-oncall` of delayed location backfill.
