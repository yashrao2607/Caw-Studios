# Module 02 — BREAK: missing index on frequently queried field

## Bug injected

The `Link_code_key` UNIQUE index was dropped from the database (a classic
"remove the index to speed up inserts" regression) while the schema stayed
unchanged.

## Symptom reproduced

The redirect lookup — the hottest query in the system — degraded from an
Index Scan to a full table scan:

```
Seq Scan on "Link"  (cost=0.00..55.03 rows=1 width=40) (actual time=0.021..0.231 rows=1 loops=1)
  Filter: (code = 'abc123'::text)
  Rows Removed by Filter: 2001
```

Before the break (baseline captured in `query-by-code.txt`):

```
Index Scan using "Link_code_key" on "Link"  (cost=0.15..8.17 rows=1 width=96)
```

- 2002 rows scanned (2001 filtered out) for a single-code lookup.
- Cost estimate jumped from 0.15..8.17 (indexed) to 0.00..55.03 (full scan).
- With 10M links this becomes a 10M-row scan per redirect — latency grows
  linearly with table size.

## Why this symptom is dangerous

The app keeps working — every query returns correct results — so nothing
"breaks" in tests. Only EXPLAIN exposes it, and only once the table is large
enough for the planner to avoid the index. It is a silent, compounding
regression.
