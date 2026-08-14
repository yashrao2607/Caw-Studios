## Bug 5: Race Condition on Analytics Write (Check-Then-Act)
- Symptom: Intermittent HTTP 500 errors on popular short links under high concurrency with database unique constraint violation: `duplicate key value violates unique constraint "analytics_link_id_bucket_unique"`.
- Hypothesis:
  - Hypothesis A: Data edge case (corrupt short code or special character metadata). Disproven by replicating with standard ascii slugs.
  - Hypothesis B: Check-then-act race condition during analytics recording (`SELECT` then `INSERT`). Concurrent requests simultaneously see zero existing rows and both execute `INSERT`, causing unique constraint failure on the second write.
- Reproduction: Created minimal synthetic concurrency script `progress/repro-race.js` firing 10 concurrent requests to `/r/:code`.
- Root Cause: Application performed separate read and write phases without database-level atomicity or row locks.
- Fix: Converted check-then-act pattern to an atomic database upsert (`INSERT ... ON CONFLICT (link_id, timestamp_bucket) DO UPDATE SET count = analytics.count + 1`) and decoupled analytics recording via async queue with deduplication keys.
- Verification proof: Ran `progress/repro-race.js` across multiple iterations (10 concurrent requests each); verified 100% 302 redirects with exactly 0 HTTP 500 errors and exact count increment.

## Injected Break: Lost Update on Timestamp in Concurrent Upserts
- Symptom: Silent data corruption where `last_accessed_at` in the database reflects an earlier request rather than the latest request in a concurrent batch.
- Root Cause: Multi-statement execution gap where `last_accessed_at` was updated via a separate secondary `UPDATE` query without monotonic ordering guarantees. Out-of-order execution resulted in older requests overwriting newer timestamps.
- Fix: Merged timestamp tracking into the single atomic upsert using PostgreSQL's monotonic `GREATEST` operator:
  `last_accessed_at = GREATEST(analytics.last_accessed_at, EXCLUDED.last_accessed_at)`.
- Verification proof: 10 concurrent requests verified across 5 test cycles; confirmed `count = 10` and `last_accessed_at` matches the latest request timestamp with zero regression.

