# Upsk System Design Fundamentals — Full Session Summary

Session: `o3hm_CJhhfZG-JmgV2s2J` · Skill: `system-design-fundamentals` · Product: URL shortener (public_consumer)
Modules completed this session: **04 (Auth) → 05 (Error/Logging) → 06 (Caching) → 07 (Background Jobs)** — Practitioner Pack **COMPLETED** (waiting for Operator pack unlock).

---

## 1. Environment & Stack

| Item | Value |
|---|---|
| Workspace | `D:\Caw Studios\upsk-system-design-workspace` |
| API | NestJS at `http://localhost:3000` |
| DB | PostgreSQL 16, Docker container `upsk-sdf-postgres`, host port **5433**, db `upsk_sdf` (host 5432 occupied by another Postgres) |
| Redis | `upsk-sdf-redis` (redis:7-alpine), port 6379 |
| ORM | Prisma 7 (prisma.config.ts + @prisma/adapter-pg), migration `20260805111141_init` |
| Queue | BullMQ (`clicks` + `clicks-dlq` queues), in-process worker (concurrency 5, attempts 3, exp backoff) |
| Env | `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/upsk_sdf?schema=public` (`.env` + `.env.bak`) |
| Auth | JWT, 1h expiry, `JwtAuthGuard` |
| Rate limits | default 300/min, login 10/min, create-link 30/min, redirect 120/min, analytics 60/min |
| upsk CLI | v0.1.30 (binary re-downloaded from `https://api.upsk.to/download/windows-amd64`) |
| Session file | `C:\Users\yashr\.upsk\api.upsk.to\session.json` (nonce source for `upsk report`) |
| State | `progress\state.json` — modules 01–07 progress, decisions, bug records |

### Credentials / test data
- User A: `test_auth@example.com` / `password123` (id 1) → token in `C:\Users\yashr\AppData\Local\Temp\opencode\tokenA.txt`
- User B: `user_b@example.com` / `password123` → tokenB.txt
- Test link: id **2089**, code **q4CBGI**, current long_url `https://example.org/reg-check`

### API restart recipe (Windows)
```
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'dist\\src\\main\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Process -FilePath "C:\Program Files\nodejs\node.exe" -ArgumentList '"D:\Caw Studios\upsk-system-design-workspace\apps\api\dist\src\main.js"' -WorkingDirectory "...\apps\api"
```
⚠️ Lessons learned:
- The argument MUST be quoted (space in `Caw Studios`).
- Do NOT use `-RedirectStandardOutput` for long-lived starts — the shell tool kills the process tree on timeout; detached start (no redirect) survives.

---

## 2. Module 04 — Authentication & Authorization ✅

**Decision:** JWT (B) over API keys — per-user identity for owner-scoping + 1h expiry self-heals leaked tokens.

**Injected bug (hard): IDOR**
- Symptom: user B (non-owner) `GET /links/2089` → **200** with owner A's payload (should be 404)
- Root cause: `findOneForUser` dropped `createdBy` filter (`findFirst {id, createdBy}` → `findUnique {id}`)
- Fix: restored owner scoping
- Regression: B → 404, A → 200, no auth → 401
- Evidence: `progress\evidence\module-04\idor-repro.txt`, `reflect.md`

---

## 3. Module 05 — Error Handling & Logging ✅

**Decision:** Graceful degradation (B) — redirect hot path must never 500 on dependency failure; fail-fast only for validation/boot config.

**Built:**
- `common/request-logging.interceptor.ts` — logs requestId, route, statusCode, latencyMs
- `common/request-id.middleware.ts` — x-request-id or randomUUID
- `main.ts` — wires middleware + interceptors + `AllExceptionsFilter` + ValidationPipe (whitelist + forbidNonWhitelisted)
- pino redact: `req.headers.authorization`, `req.headers.cookie` → `[REDACTED]`

**Injected bug (hard): PII in logs**
- Symptom: sentinel `DO_NOT_LOG_ME_123` in Authorization header appeared verbatim in server logs after 401
- Fix: removed raw `authorizationHeader` from filter warn context
- Verified: sentinel absent post-fix; 400 envelope (validation), forced 500 envelope (temporary throw in health controller, reverted)
- Evidence: `progress\evidence\module-05\error-envelope.md`, `pii-logged-repro.txt`, `reflect.md`
- M5 report submitted (nonce `_zsB7Y10jQ-E4ynpWerb6`); latest score 9.6/10

---

## 4. Module 06 — Caching with Redis ✅

**Twist:** abuse_spike (public_consumer) → implement_now: redirect throttle 120/min proven (130 requests → 95×302 + 35×429).

**Decision:** Cache-aside (A) — reads >> writes; write-through still needs delete invalidation.

**Built:**
- Cache-aside in `links.service.ts` `findByCode`: `link:code:<code>` key, TTL 3600s, `x-cache: HIT|MISS|DOWN`
- `PATCH /links/:id` (new) + `updateForUser` — owner-scoped, invalidates `link:code:*` + `link:id:*`
- Redis-down graceful: fail-fast ioredis (`connectTimeout: 2000, maxRetriesPerRequest: 1, enableOfflineQueue: false, retryStrategy backoff 500ms→5s cap`), DB fallback `x-cache: DOWN`, auto-reconnect
- SafeHttpUrl now accepts uppercase schemes

**Injected bug (hard): thundering herd**
- Repro: DEL key + 150ms simulated slow DB + 30 concurrent curls → **5 parallel DB loads** (instrumented `[herd-instrument]`)
- Fix: single-flight coalescing — `inflight Map<code, Promise>` (cleared in finally)
- Regression: 30 concurrent → **exactly 1 DB load**
- Evidence: `progress\evidence\module-06\cache-aside-build.txt`, `thundering-herd-repro.txt`, `reflect.md`

---

## 5. Module 07 — Background Jobs & Analytics ✅ (COMPLETED)

**Decision:** Async queue (B) — redirect latency never hostage to a click write; clicks are append-only, loss-tolerant telemetry.

**Built:**
- `ClickEvent.dedupeKey` (sha256 of `code|clickedAt|ipHash|userAgent|referrer`) + `@@unique` — migration `20260813190000_click_dedupe_key` (manual SQL + `migrate deploy`; `migrate dev` fails non-interactive)
- `ClicksWorker`: computes dedupeKey, `createMany(skipDuplicates: true)` — duplicate/retried jobs skip
- `GET /links/:id/analytics?from&to` — owner-scoped (A: 200 count + last_clicked_at, B: 404), throttle 60/min
- `RetentionService` — purge on boot + interval (`RETENTION_DAYS` default 30, `RETENTION_PURGE_INTERVAL_HOURS` default 24)
- **DLQ fix:** `clicks.producer.ts` → FlowProducer (parent in `clicks-dlq`, child in `clicks`); new `dlq.worker.ts` logs DLQ ALERT + increments Redis `dlq:alert:count`

**Injected bug (hard): missing DLQ → silent loss**
- Repro: poisoned job (invalid `clickedAt`) exhausted 3 attempts → sat in `bull:clicks:failed` (id 414), zero alerting
- Fix: FlowProducer DLQ → parent fails → DlqWorker alerts (counter went 1→3 for 3 poisoned jobs)
- Regression: normal redirects still record clicks (link 2089 count 3 → 5)
- Evidence: `progress\evidence\module-07\async-queue-build.txt`, `dlq-missing-repro.txt`, `dlq-fix.txt`, `reflect.md`
- M7 report submitted (nonce `Z8-oUJ4vtHd07jI3CDlIO`); score **10.0/10.0**

**Proven end-to-end:** 2 redirects → +2 ClickEvent rows via worker; idempotency (same payload ×2 → 1 row); privacy (sha256 ipHash only, no raw IP column); queue-down drill (Redis stopped → 302 still served, no hang); retention (90-day-old seed purged with RETENTION_DAYS=0).

---

## 6. Key Command Recipes

```powershell
# Read current step (clean output)
$s = upsk status --json 2>$null | ConvertFrom-Json
($s.content -replace '[^\u0000-\uFFFF]', '') | Select-String "STEP"

# Record decision
upsk decide A --reasoning "..."

# Advance (requires --summary + --evidence)
upsk next --summary "..." --evidence "..."

# Submit evaluation report (stdin JSON; ONLY valid during REFLECT)
$json = Get-Content "C:\Users\yashr\AppData\Local\Temp\opencode\m7-report.json" -Raw
$json | upsk report

# Nonce source
(Get-Content "C:\Users\yashr\.upsk\api.upsk.to\session.json" -Raw | ConvertFrom-Json).sessions.'system-design-fundamentals'.nonce

# psql via docker (PowerShell-safe — escape double quotes or use stdin)
$sql | docker exec -i upsk-sdf-postgres psql -U postgres -d upsk_sdf -f -

# Redis inspection
docker exec upsk-sdf-redis redis-cli GET "dlq:alert:count"
docker exec upsk-sdf-redis redis-cli ZRANGE "bull:clicks:failed" 0 -1
```

**Docker outage recovery (happened this session):** Docker Desktop died → containers Exited(255) → `docker start upsk-sdf-postgres upsk-sdf-redis` brought them back with data intact.

---

## 7. Reports & Scores

| Module | Report | Score |
|---|---|---|
| 04 | ❌ Rejected — state auto-advanced to INTERLUDE before submission ("Report can only be submitted during REFLECT") | — |
| 05 | ✅ Submitted | 9.6/10 |
| 06 | ❌ Rejected — same auto-advance race (report window closed at Module 6 / INTERLUDE) | — |
| 07 | ✅ Submitted | **10.0/10** |

---

## 8. Pack Status & Evidence Inventory

### Practitioner Pack (Modules 04–07): ✅ **COMPLETED**

- `progress\evidence\module-04\` — idor-repro.txt, reflect.md
- `progress\evidence\module-05\` — error-envelope.md, pii-logged-repro.txt, reflect.md
- `progress\evidence\module-06\` — cache-aside-build.txt, thundering-herd-repro.txt, reflect.md
- `progress\evidence\module-07\` — async-queue-build.txt, dlq-missing-repro.txt, dlq-fix.txt, reflect.md
- `progress\state.json` — full bootcamp state (decisions + bug records + modules 01–07 complete)

---

## 9. Completed Skills & Catalog Status

### 1. `system-design-fundamentals`
- **Launchpad Pack (Modules 01–03)**: ✅ **COMPLETED**
- **Practitioner Pack (Modules 04–07)**: ✅ **COMPLETED** (Module 07 Scored **10.0 / 10.0**)
- **Operator Pack (Modules 08–10)**: `awaiting_unlock`

### 2. `debugging-incident-response`
- **Launchpad Pack (Modules 01–03)**: ✅ **COMPLETED**
  - **Module 01 (Hypothesis-First Debugging)**: Scored **9.0 / 10.0** (Top-down debugging, `DATABASE_URL` startup config vs DB error, off-by-one pagination, concurrent non-deterministic sorting).
  - **Module 02 (Reading Logs Like a Story)**: Scored **9.3 / 10.0** (Log level precedence override, UTC midnight comparison mismatch, CRLF log injection / forgery defense).
  - **Module 03 (Reproduction Science / Concurrency)**: Scored **9.3 / 10.0** (Synthetic concurrency reproduction `progress/repro-race.js`, check-then-act race condition atomic upsert, silent timestamp corruption monotonic `GREATEST` fix).
- **Practitioner Pack (Modules 04–05)**: `awaiting_unlock`

### 3. Other Catalog Skills
- `production-readiness`: Launchpad (3 free modules)
- `decomposition-execution-planning`: Launchpad (3 free modules)
- `ai-augmented-engineering`: Launchpad (3 free modules)
- `technical-communication`: Launchpad (2 free modules)