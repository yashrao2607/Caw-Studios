# Module 02 — Indexes Must Match Query Patterns

## Why indexes must match query patterns

An index is a redundant, sorted copy of a column's data. It only pays off if the
query planner can use it — i.e. the query's filter, join, or ORDER BY clauses
align with the index's column order. An index that matches nothing is pure
write overhead: every INSERT/UPDATE pays to maintain it, and reads never use it.

## The three planned queries and their matching indexes

| Query pattern | Index | Why it matches |
|---|---|---|
| `SELECT * FROM "Link" WHERE code = $1` (redirect — hottest path, equality lookup on a short, high-cardinality key) | `UNIQUE` on `Link.code` | B-tree equality lookup is O(log n) vs full scan; UNIQUE also guarantees one short code → one link and powers `createMany` skipDuplicates. |
| `SELECT * FROM "Link" WHERE created_by = $1` (owner dashboard — "my links") | index on `Link.created_by` | Rows for one owner live contiguously in the index; no full table scan per dashboard load. |
| `SELECT count(*) FROM "ClickEvent" WHERE link_id = $1 AND clicked_at BETWEEN a AND b GROUP BY ...` (per-link analytics over a time range) | composite index on `ClickEvent(linkId, clickedAt)` | Column order matches filter order: Postgres walks one contiguous range of the index (no sort needed for the group-by); also serves the FK join on `linkId` alone. |

## Verified in the running Postgres (postgres:16 on port 5433)

```
public | Link_code_key                   | index | postgres | Link
public | Link_createdBy_idx              | index | postgres | Link
public | ClickEvent_linkId_clickedAt_idx | index | postgres | ClickEvent
```

## Evidence of the hot query

Seeded 2 links; look-up by code with EXPLAIN shows an **Index Scan** using
`Link_code_key` (estimated ~1 row, not a Seq Scan over the whole table).
