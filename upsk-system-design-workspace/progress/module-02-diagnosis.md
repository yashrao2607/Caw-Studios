# Module 02 Diagnosis Notes

## Bug 3: Log Level Misconfigured
- Symptom: Error logs appear with 404/500 responses, but request arrival and response completion lines are missing (orphaned errors).
- Hypothesis: Logger configuration contains a hardcoded `WARN` or `ERROR` default that overrides `LOG_LEVEL=info` environment variable due to short-circuit precedence order (`config.level || process.env.LOG_LEVEL`).
  - Command: Inspect logger initialization in `common/logger` or `main.ts`.
  - Observation: Verified logger honors `process.env.LOG_LEVEL || 'info'`, outputting structured request/response cycles with `requestId`, `method`, `path`, `statusCode`, and `latencyMs`.
- Fix: Removed hardcoded config overrides, binding logger level dynamically to `process.env.LOG_LEVEL || 'info'`.
- Verification proof: `GET /health` and `POST /links` output correlated `request received` and `response sent` entries with matching `requestId`.

## Bug 4: Timestamp Timezone Mismatch
- Symptom: Links created near midnight UTC intermittently return 404 for several hours, then magically reappear once local server time crosses midnight.
- Hypothesis: Application queries and logs in UTC (`Z`), but database stores naive timestamps or evaluates `NOW()` in local server timezone (e.g. EST / UTC-5), creating a multi-hour query evaluation gap around midnight.
  - Command: Compare application `created_at` ISO string (`toISOString()`) against PostgreSQL `timestamptz` column definition.
  - Observation: `timestamptz` in Postgres + ISO UTC strings in application ensure exact epoch alignment across timezones.
- Fix: Standardized all timestamp storage and queries on UTC ISO-8601 (`timestamptz` in PostgreSQL, `new Date().toISOString()` in Node.js runtime). Presentation conversions restricted to UI layer only.
- Verification proof: Links created at `23:59:50.000Z` immediately resolve on `GET /r/:code` with zero delay or timezone offset blindness.

## Injected Break: Log Injection (CRLF Log Forgery)
- Symptom: Forged "admin login successful" log entry appeared with `req_id: r-102` nested inside `r-101` payload.
- Root Cause: Unsanitized user input (`url`) contained an unescaped newline `\n` and a crafted JSON payload. When logged directly, it emitted a split newline that downstream log aggregators ingested as an independent forged event.
- Fix: Sanitized all user inputs before logging (escaped CRLF/control characters) and enforced structured JSON serialization via Pino. Additionally, input validation (`SafeHttpUrl`) rejects control characters `/[\u0000-\u001f\u007f]/` at the perimeter.
- Verification proof: Submitting a crafted payload with embedded newlines is safely rejected with HTTP 400 and serialized as an escaped string literal without splitting log lines.

