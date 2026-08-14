# Module 02 — FIX: restoring the dropped code index

## Diagnosis

Schema/code vs live database drift. `prisma/schema.prisma` still declares
`code String @unique` — the model never changed. Only the live database was
tampered with: `Link_code_key` was dropped (unversioned, no migration tracked
it). The symptom (Seq Scan on the hottest query) pointed at the database
layer, not the code, because the code was always correct.

Root cause: the index is part of the schema contract — `@unique` is both a
performance index and a data-integrity constraint. Dropping it silently
removes uniqueness enforcement too.

## Fix

Recreated the constraint exactly as the schema declares it, keeping DB and
schema identical:

```
CREATE UNIQUE INDEX "Link_code_key" ON "Link"("code");
```

(No schema/migration change needed — the fix is restoring the DB to match the
committed schema. A migration would only be needed if the schema itself
changed.)

## Proof

1. Query plan improvement (the required proof):
   - Broken: `Seq Scan on "Link" (cost=0.00..55.03 rows=1) Rows Removed by Filter: 2001`
   - Fixed:  `Index Scan using "Link_code_key" on "Link" (cost=0.28..8.29 rows=1) Index Cond: (code = 'abc123'::text)`
2. Integrity restored — duplicate insert rejected:
   `ERROR: duplicate key value violates unique constraint "Link_code_key" ... Key (code)=(abc123) already exists.`
3. `prisma migrate status` → "Database schema is up to date!" (no drift).
4. `\di` → `Link_code_key` present; `Link_createdBy_idx` and
   `ClickEvent_linkId_clickedAt_idx` unaffected.

## Regression guard

This is exactly the class of bug a schema-drift check or a query-plan test
would catch — noted for Module 9 (testing): add an e2e test asserting the
redirect executes an Index Scan, or a migration-status check in CI.
