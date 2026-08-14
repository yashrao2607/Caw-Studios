# Module 06 - REFLECT

## Chosen cache strategy
cache-aside (`decisions.module_06.cache_strategy = cache_aside`):
app reads/writes Redis explicitly; DB is the source of truth; cache is an accelerator.

## What we shipped
- Cache-aside on the redirect hot path: `findByCode` -> Redis GET (`link:code:<code>`, TTL 3600s),
  keys computed in links.service.ts; on miss stores JSON `{longUrl, expiresAt}`.
- Invalidation on every mutation: PATCH /links/:id (`updateForUser`) and DELETE (`removeForUser`)
  both `del link:code:<code>` + `link:id:<id>` with owner-scoped checks.
- Graceful Redis-down behavior: fail-fast ioredis client (connectTimeout 2000ms,
  maxRetriesPerRequest 1, enableOfflineQueue false, capped backoff retryStrategy);
  `findByCode` catches Redis errors -> DB fallback with `x-cache: DOWN`; all set/del guarded
  with catch; client auto-reconnects when Redis returns.
- Thundering-herd fix: single-flight coalescing via in-flight Promise map per code
  (proven 30 concurrent cold-key redirects -> exactly 1 DB load).

## New failure mode introduced by caching
Stale-data serving (bypassed invalidation): a link update that forgets to invalidate
`link:code:<code>` serves the OLD long_url until TTL expires. This is the canonical cost
of cache-aside's "control = responsibility": one missing `del` breaks correctness silently.
Secondary: thundering herd on cold key (cache stampede to DB) under an abuse spike.

## Risks & mitigations
- Risk 1: cache stampede under concurrency spike -> mitigation: single-flight coalescing + TTL bound.
- Risk 2: stale data after missed invalidation -> mitigation: invalidate in BOTH mutation paths + 1h TTL self-heal.
- Risk 3: Redis outage coupling -> mitigation: fail-fast client, DB fallback (x-cache: DOWN), auto-reconnect, guarded writes.

## Mini practical task (STEP 4 verification action; reproducible)
```
curl -i http://localhost:3000/r/q4CBGI        # 1st: x-cache: MISS
curl -i http://localhost:3000/r/q4CBGI        # 2nd: x-cache: HIT   <- cache hit proven
PATCH /links/2089  long_url=https://example.org/reg-check
curl -i http://localhost:3000/r/q4CBGI        # 302 Location=https://example.org/reg-check, x-cache: MISS <- invalidation proven
docker stop upsk-sdf-redis
curl -i http://localhost:3000/r/q4CBGI        # 302 + x-cache: DOWN (no hang) <- Redis-down fallback proven
docker start upsk-sdf-redis
curl -i http://localhost:3000/r/q4CBGI        # x-cache: HIT (auto-reconnect, no API restart)
```

## Knowledge check answers
1. Core problem solved: fast, correct reads on the redirect hot path without hammering the DB —
   read-through cache keyed by code + explicit invalidation + graceful degradation when the cache is unavailable.
2. Biggest-impact decision: cache-aside vs write-through. Cache-aside won because reads >> writes:
   write-through would tax every create/update with an extra Redis write for no read benefit and
   still needs delete-time invalidation; cache-aside keeps the write path simple and pushes
   freshness responsibility onto explicit invalidation, which we enforce in both mutation paths.
3. End-to-end evidence: MISS->HIT transition; PATCH changes Location header and resets to MISS
   (no stale URL); Redis down -> 302 + x-cache DOWN, no hang; Redis restored -> HIT without restart;
   herd regression: 30 concurrent -> 1 DB load.

## No terminology gaps
All module concepts (cache-aside, write-through, invalidation, TTL, single-flight, stampede,
graceful degradation, fail-fast client) were used correctly in the session.