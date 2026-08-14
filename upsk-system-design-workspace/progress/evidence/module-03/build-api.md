# Module 03 — BUILD: Core API & CRUD

## PAUSE: why validation is a security boundary

Validation is the checkpoint where untrusted input stops being bytes and becomes our data. A `long_url` is not a string — it is an instruction: `javascript:`/`data:` schemes that consumers may execute, `Location` header values that can smuggle newlines, open-redirect payloads weaponizing our trusted domain. What passes validation is what gets stored, redirected to, and rendered later. So: whitelist not blacklist, validate at the edge, reject with 400, never store what failed to parse.

## Routes (decision A: /r/<code>)

- POST /links {long_url, expires_at?, tags?} -> 201 {id, code, short_url, long_url, created_at}
- GET /links?page&limit -> paged list {items, total, page, limit}
- GET /links/:id -> link
- GET /r/:code -> 302 + Location (public), 404 generic (no internal error leak)

## Validation rules

- Trim input; reject control chars, backslashes, and non-trimmed input before parse
- Scheme whitelist: http/https only via WHATWG URL parse (rejects encoded-scheme, encoded-slash, scheme-relative, userinfo tricks)
- expires_at must be in the future; tags <= 10 items, each <= 32 chars
- Global ValidationPipe with whitelist + forbidNonWhitelisted

## Abuse suite (all 400, nothing stored)

javascript:alert(1) | JaVaScRiPt:alert(1) | " javascript:alert(1) " | data:text/html,<svg/onload=alert(1)> | //evil.example.com | http:%2f%2fevil.example.com | http%3A%2F%2Fevil.example.com | http:\\evil.example.com | https://good.com@evil.example.com | newline-in-url
