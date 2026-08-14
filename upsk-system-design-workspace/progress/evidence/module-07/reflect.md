# Module 07 - REFLECT

## Chosen jobs strategy
async_queue (`decisions.module_07.jobs_strategy = async_queue`):
BullMQ on Redis; redirect enqueues fire-and-forget; in-process worker (concurrency 5,
attempts 3, exponential backoff) writes ClickEvent rows; FlowProducer DLQ (clicks-dlq)
catches permanently-failed jobs with alerting.

Why: redirect is the hot path — a sync DB write makes latency hostage to the database
(cluster latency, pool pressure). Clicks are append-only, loss-tolerant analytics:
availability of the redirect >> completeness of the click.

## Operational risk introduced by async
Producer/worker decoupling hides failures until jobs are silently lost or double-processed:
- missing DLQ = poisoned job dies silently (the injected bug)
- non-idempotent worker = retry redelivery double-counts clicks
- queue-name mismatch = jobs vanish between queues
You can't look at the redirect handler anymore; you must trace the full
producer → queue → worker → DB path. Mitigations shipped: dedupeKey UNIQUE constraint +
skipDuplicates (idempotency at the DB write), FlowProducer DLQ + DlqWorker alert counter,
worker failed-event logging, retention purge.

## Knowledge check answers
1. Core problem: decouple analytics from the redirect hot path so availability of the
   product never depends on the analytics pipeline — with a reliability story (retries,
   idempotency, DLQ, retention) so telemetry stays correct.
2. Biggest-impact decision: sync vs async. Async wins because every click would otherwise
   add a DB write to the redirect response; the cost is operational complexity, which we
   pay for explicitly with DLQ + idempotency + monitoring.
3. End-to-end evidence: 2 redirects -> worker logs + ClickEvent +2; analytics endpoint
   returns count/last_clicked (owner A 200, B 404); same payload enqueued twice -> 1 row
   (idempotency); poisoned job -> clicks-dlq -> dlq:alert:count increments (DLQ); Redis
   stopped -> redirect still 302 (queue-down drill); retention purge deletes old clicks.

## Mini practical task (STEP 4 verification, reproducible)
```
curl -i http://localhost:3000/r/q4CBGI   (x2, 302 each)
GET /links/2089/analytics?from=2000-01-01&to=2100-01-01 (owner JWT) -> click_count +2
replay same job payload twice -> ClickEvent rows for that dedupeKey = 1
```

## Risk & mitigation
- Risk: poisoned job silently lost (async decoupling) -> mitigation: FlowProducer DLQ
  (clicks-dlq) + DlqWorker alert (dlq:alert:count) + failed-event logging.
- Risk: retry redelivery double-counts -> mitigation: sha256 dedupeKey UNIQUE + createMany skipDuplicates.

## No terminology gaps
at-least-once, idempotency key, DLQ, retries/backoff, retention, fire-and-forget,
producer/worker decoupling all used correctly.