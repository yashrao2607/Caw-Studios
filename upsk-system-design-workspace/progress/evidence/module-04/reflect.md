# Module 04 REFLECT

## Auth method chosen + why
JWT (signed bearer tokens, 1h expiry) over static API keys.

- Expiry is built-in: a leaked token self-heals in 1h; an API key is valid forever until rotated.
- Claims carry identity (`sub` = user id), which is required for Module 04's authorization rules (owner-scoped link access, admin surface).
- Stateless verification, no per-request DB lookup; guard validates signature + claims.

## One security practice learned
Authorization must be enforced per-resource, not just per-route. A valid JWT proves *who* you are, not *what* you may read — after this module's IDOR drill, `findOneForUser` scopes by `createdBy: userId` and no endpoint trusts the token alone to grant object-level access.

## Knowledge check
1. Core problem solved: separate *authentication* (prove identity — JWT issue + signature verification) from *authorization* (identity-based rules — owner scoping on links, admin-only surface), so public redirect flows stay anonymous while admin surfaces are gated.
2. Biggest-impact decision: JWT with 1h expiry + explicit ownership checks, because every downstream authorization rule (owner-only read/delete, admin list, audit attribution via `createdBy`) depends on trustworthy identity claims.
3. End-to-end evidence: `GET /links` no-auth -> 401, with valid JWT -> 200; `GET /links/:id` owner -> 200 with payload, non-owner -> 404; IDOR regression after fix (B 404 / A 200); link rows carry `createdBy` = audited user id.

## Mini practical task (STEP 4 verification re-run)
Command: `curl GET /links` with and without `Authorization: Bearer <jwt>`.
Proof: no auth -> 401; with JWT -> 200. (Login -> 201, JWT decode shows `sub`; 1h expiry set.)