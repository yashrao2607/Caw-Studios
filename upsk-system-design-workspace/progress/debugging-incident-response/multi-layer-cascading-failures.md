# Multi-Layer Cascading Failures, Resource Isolation & Cache Namespace Partitioning

**Module:** Debugging & Incident Response - Module 06 (Operator Pack)  
**Target Architecture:** URL Shortener & Analytics Platform  
**Incident Focus:** Multi-layer interaction bugs across Cache, Database, Asynchronous Queue Workers, and Cache Key Namespace Collision  

---

## 1. Bug #9: Phantom Redirects via Cache Invalidation Omission

### 1.1 Symptom & Vertical Investigation
* **Observed Symptom:** Deleted short links continued to redirect users to target destinations for up to 5 minutes post-deletion.
* **Vertical Request Trace:**
  1. User issued `DELETE /api/v1/links/:id`.
  2. The delete handler executed `await db.delete(id)` successfully and returned HTTP 200 OK.
  3. Subsequent `GET /:shortCode` checked Redis cache (`await redis.get(shortCode)`), returned the cached URL, and issued a 302 Redirect.
  4. Root Cause: The delete handler omitted Redis cache invalidation (`await redis.del(cacheKey)`), creating an asynchronous state inconsistency until the 5-minute TTL elapsed.

### 1.2 Remediation
* **Implementation:** Integrated explicit cache invalidation in delete/update handlers:
  ```typescript
  // DELETE /api/v1/links/:id
  await db.transaction(async (tx) => {
    const link = await tx.links.findById(id);
    if (!link) throw new NotFoundError('Link not found');
    await tx.links.delete(id);
    await redis.del(`link:redirect:${link.shortCode}`);
  });
  ```

---

## 2. Bug #10: Queue Retry Storm & Shared Connection Pool Starvation

### 2.1 The 12-Step Cascading Failure Chain
1. Background analytics worker encountered an unhandled payload exception during a database write.
2. Queue worker initiated an immediate retry with 0ms delay (no backoff).
3. The retry acquired an active connection from the shared PostgreSQL connection pool (`max: 20`).
4. The retry failed again with the identical exception.
5. The retry loop continued indefinitely (no `max_retries` threshold configured).
6. Tight retry loops across 5 concurrent workers rapidly leased all 20 connection pool slots.
7. The shared connection pool reached 100% saturation (0 available connections).
8. Incoming HTTP API requests (`GET /:shortCode`, `POST /links`) blocked waiting for pool leases.
9. HTTP requests hung indefinitely until client timeouts occurred.
10. The entire user-facing API became completely unresponsive without generating application crashes.
11. Synthetic health check probes (`GET /healthz`) timed out waiting for database ping queries.
12. Monitoring alerted a total service outage.

### 2.2 3-Part Architectural Remediation
1. **Exponential Backoff with Jitter:** Delay = $\min(1000 \times 2^{\text{attempt}}, 30000) + \text{jitter}$.
2. **Max Retry Bound & Dead-Letter Queue (DLQ):** Max 5 retries; unrecoverable jobs route to `analytics_dlq`.
3. **Bulkhead Pattern:** Partitioned database connection pools (`apiDbPool`: 15 connections, `workerDbPool`: 5 connections).

---

## 3. Post-Deployment Regression: Cache Key Namespace Collision

### 3.1 Problem Mechanics
* The analytics queue worker reused the redirect cache key prefix (`link:redirect:<short_code>`) as its idempotency/deduplication marker.
* When `DELETE /links/:id` ran `DEL link:redirect:<short_code>`, it inadvertently wiped the analytics deduplication record.
* When the short code was subsequently re-registered, old pending/replayed analytics events processed a second time, doubling metrics counts.

### 3.2 Strict Cache Namespace Partitioning
* **Redirect Cache Namespace:** `link:redirect:<short_code>` (TTL: 300s, invalidated on link update/delete).
* **Analytics Idempotency Namespace:** `analytics:dedup:<job_id>` (TTL: 86400s, never invalidated by link lifecycle mutations).

```typescript
// analytics/worker.ts
export async function processAnalyticsJob(job: Job<AnalyticsPayload>) {
  const dedupKey = `analytics:dedup:${job.id}`;
  const acquired = await redis.set(dedupKey, '1', 'EX', 86400, 'NX');
  if (!acquired) {
    logger.warn({ msg: 'Duplicate analytics job skipped', jobId: job.id });
    return;
  }
  await recordAnalytics(job.data);
}
```

---

## 4. Empirical Verification Matrix

| Test Scenario | Action | Expected Result | Actual Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Link Deletion Invalidation** | `DELETE /links/123` then immediate `GET /code123` | Immediate `404 Not Found` | `404 Not Found` in 1.4ms | PASS |
| **Queue Retry Storm** | 500 failing worker jobs injected | Exponential backoff, DLQ after 5 retries | Handled via DLQ, 0 dropped API requests | PASS |
| **Bulkhead Isolation** | Worker pool saturated at 5/5 connections | API requests execute unimpeded on 15 dedicated slots | API p99 latency = 13.8ms | PASS |
| **Re-creation Dedup Isolation** | Delete link, re-create with same code, replay job | Analytics recorded exactly once | Exactly 1 event recorded | PASS |
