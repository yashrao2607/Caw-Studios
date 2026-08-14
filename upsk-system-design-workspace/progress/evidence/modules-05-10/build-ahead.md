# Module 05 — Errors & Logging (build-ahead)

- `AllExceptionsFilter` (global): JSON `{statusCode, error, message, requestId, path, timestamp}`; hides internals on 5xx in production; DB errors mapped to 400 without leaking SQL
- `RequestIdMiddleware`: generates UUID, honors inbound `x-request-id`
- pino structured logs via `LoggerModule`: per-request `requestId`, method, url, status, responseTime; `authorization`/`cookie` headers redacted

Verified live: 401/404 responses carry requestId; inbound `x-request-id: my-trace-42` propagated to response and logs; warning+completion log lines in JSON form.

# Module 06 — Caching (build-ahead)

- `RedisModule` (ioredis, global); redirect path: `GET /r/:code` → Redis `link:code:<code>` (TTL 3600s) → miss falls through to Postgres index scan → populates cache
- `x-cache: HIT|MISS` header; expired links evicted on read; `DELETE /links/:id` invalidates the key

Verified live: `DEL link:code:xyz999` → 1st request `x-cache: MISS`, 2nd `HIT`; `GET link:code:BvUQW7` = cached JSON; `TTL` = 3599.

# Module 07 — Background Jobs (build-ahead)

- BullMQ `clicks` queue: redirect enqueues `{code, clickedAt, userAgent, referrer, ipHash}` (attempts 3, exponential backoff); worker (concurrency 5) resolves link and inserts `ClickEvent`
- Redirect is non-blocking — analytics failures never break the 302

Verified live: `ClickEvent` count 1→2 after a redirect; new row has `userAgent=curl/8.21.0` and sha256 `ipHash` (no raw IP); wait queue drained to 0.

# Module 08 — Search (build-ahead)

- `GET /links/search?q=` (auth): OR across `longUrl` (ILIKE), `code` (ILIKE), `tags` (`has`); paginated, scoped to owner

Verified live: `q=example.com/m4` → 2, `q=auth` (tag) → 2, `q=BvUQW7` (code) → 1; unauthenticated → 401.

# Module 09 — Testing (build-ahead)

- `test/app.e2e-spec.ts` + `test/jest-e2e.json`: auth lifecycle, 9 abuse payloads, past expiry, 11 tags, missing token, redirect 302/404, identical 404 for unknown/expired, owner-scoped list, IDOR 404, search, structured error shape

Result: `npm run test:e2e` → **27 passed / 27 total**. (E2E uncovered a real regression: DTO `@Transform(trim)` defeated the validator's whitespace check, and WHATWG parsing normalized `HTTP://`; validator now rejects padded, mixed-case, and encoded-slash URLs.)

# Module 10 — CI/CD (build-ahead)

- `apps/api/Dockerfile`: multi-stage `node:22-alpine`, `npm ci`, `prisma generate`, non-root user, `HEALTHCHECK` on `/health`
- `docker-compose.yml`: postgres + redis + api with healthchecks and named volume (localhost API port unchanged)
- `.github/workflows/ci.yml`: `npm ci` → lint → `prisma migrate deploy` (schema-drift guard) → build → e2e against service containers → docker build
- `.dockerignore` excludes node_modules/dist/.env

Verified: `docker compose config` parses cleanly.
