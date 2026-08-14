# Module 05 REFLECT

## Error strategy chosen + why
Graceful degradation (B) as primary: redirect hot path must never 500 on a
non-critical dependency failure — fall back to DB; analytics queue down should
never block redirects (queue errors are caught and logged in the redirect
controller). Fail-fast is reserved for input validation (400 immediately) and
boot-time config (invalid PORT aborts before listen).

## One error-handling practice learned
Never let log fields and response bodies share the same trust boundary — the
injected PII bug logged the raw Authorization header through the error log path;
guards that held in responses (redaction) had to be enforced at the logging
layer too (pino redact paths + no raw header fields in logger context).

## Knowledge check
1. Core problem solved: consistent, safe error envelope (statusCode/error/message/requestId/path/timestamp) for every 4xx/5xx with zero stack-trace or secret leakage, plus structured request logs (requestId, route, statusCode, latencyMs) that tie a customer report to exact log lines.
2. Biggest-impact decision: error envelope + requestId correlation — without a stable envelope, clients can't parse failures; without requestId, no log line links to a ticket; this makes 2am incidents solvable in minutes.
3. Evidence end-to-end: 400 envelope (requestId attached), 500 envelope (no stack), sentinel token absent from logs, request logs with requestId/route/status/latency; BREAK/FIX loop proved the same guarantees under regression.

## Mini practical task
Re-ran STEP 4 verification: validation error -> 400 safe envelope with requestId;
unhandled error -> 500 safe envelope, no stack trace; sentinel
Authorization: Bearer DO_NOT_LOG_ME_123 -> 401 and absent from all logs.