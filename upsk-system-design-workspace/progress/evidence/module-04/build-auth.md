# Module 04 — Auth (build-ahead)

## What was built
- `User` model (`id`, `email` @unique, `passwordHash`, `createdAt`) + migration `add_user`
- `AuthModule`: `POST /auth/register`, `POST /auth/login` (JWT via `@nestjs/jwt`, bcryptjs 10 rounds, credential DTO: valid email + password 8-128 chars)
- `JwtAuthGuard` (Bearer token, verifies signature/expiry) + `@CurrentUser()` decorator
- All `/links` write/list/detail/delete routes guarded; ownership enforced per-user
- `DELETE /links/:id` with click-event cleanup before delete
- Redirect `/r/:code` intentionally remains public and anonymous

## Verification (all live)
| Check | Result |
|---|---|
| register | 201 + JWT + user |
| duplicate email | 400 |
| weak password / bad email | 400 / 400 |
| login wrong password | 401 |
| create with token | 201 (createdBy = user id) |
| create without token | 401 |
| garbage token | 401 |
| list | only the caller's links (total=1) |
| GET own link | 200 |
| GET other user's link (IDOR) | 404 |
| redirect public | 302 → https://example.com/m4 |
