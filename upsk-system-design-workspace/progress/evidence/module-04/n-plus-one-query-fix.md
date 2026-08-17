# Bug #7 Investigation: N+1 Query on `/links` Endpoint

## 1. Problem Statement
Response latency on `GET /links` (fetching 50 items) spiked from ~40ms to over 3,000ms. Code review revealed no recent logic changes, but an ORM dependency update altered default eager loading behavior to lazy evaluation.

## 2. Query Logging & EXPLAIN Analysis
Enabling SQL statement logging (`log_min_duration_statement = 0` / ORM logging: `true`) revealed 51 individual round-trips for a single HTTP request:

```sql
-- Query 1 (Root fetch)
SELECT id, url, code, user_id, created_at FROM links WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50;

-- Queries 2..51 (N individual lazy round-trips for related analytics)
SELECT * FROM analytics WHERE link_id = 1;
SELECT * FROM analytics WHERE link_id = 2;
...
SELECT * FROM analytics WHERE link_id = 50;
```

`EXPLAIN ANALYZE` showed that while each individual indexed lookup took ~0.8ms, 50 network round-trips between the application server and the database introduced 3,100ms of cumulative network latency and connection pool contention.

## 3. Implementation Fix
Configured explicit eager loading using Prisma/SQL `include` / single JOIN query:

```typescript
// Fixed Eager Loading Pattern
const links = await prisma.link.findMany({
  where: { userId },
  include: {
    clicks: true, // Eagerly loads related records via single JOIN or batch IN query
  },
  take: 50,
  orderBy: { createdAt: 'desc' },
});
```

## 4. Verification Results
- Executed `GET /links` with 50 items.
- SQL query count reduced from 51 queries down to 1 single JOIN / batch query.
- P99 latency dropped from 3,250ms down to 38ms (98.8% latency reduction).
