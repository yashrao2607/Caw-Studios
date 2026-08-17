# Interface Contracts: SkillSwap Parallel Workstreams (Module 06)

---

## 1. Global Shared Types & Serialization Standards
All services and parallel streams MUST strictly adhere to these primitive types:
- **Identifier Type**: RFC 4122 `UUID v4` (string representation, lowercase, e.g. `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`). Integers or custom alphanumeric slugs are strictly prohibited for primary/foreign keys.
- **Timestamp Standard**: ISO 8601 Extended Format in strict UTC with `Z` suffix (`YYYY-MM-DDTHH:mm:ss.sssZ`, e.g., `2026-09-01T10:00:00.000Z`). Local timezone offsets are rejected.
- **Monetary Values**: All currencies stored and transferred as integer `cents` (e.g. `$120.00` = `12000`). Floating-point dollars are prohibited to eliminate IEEE 754 precision drift.
- **API Base Path**: `/api/v1` prefix across all HTTP endpoints.

---

## 2. Contract Pair A: Provider Catalog API <-> Demand Booking Engine

### Provider Catalog Endpoint (Producer: Stream 1 / Ticket 02)
- **Path**: `GET /api/v1/providers`
- **Method**: `GET`
- **Headers**: `Accept: application/json`
- **Response 200 OK**:
```json
{
  "data": [
    {
      "id": "uuid-v4",
      "name": "string",
      "category": "string",
      "bio": "string",
      "avatar_url": "string (valid URL)",
      "rating": "number (float, e.g. 4.95)",
      "services": [
        {
          "id": "uuid-v4",
          "title": "string",
          "price_cents": "integer (positive)",
          "duration_minutes": "integer (positive)"
        }
      ]
    }
  ]
}
```

---

### Booking Creation Endpoint (Consumer: Stream 2 / Ticket 03)
- **Path**: `POST /api/v1/bookings`
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `Idempotency-Key: uuid-v4 (optional)`
- **Request Body**:
```json
{
  "provider_id": "uuid-v4 (required)",
  "service_id": "uuid-v4 (required)",
  "contact_email": "string (required, valid email format)",
  "scheduled_slot": "string (required, ISO 8601 UTC timestamp)",
  "notes": "string (optional, max 500 chars, no HTML tags)"
}
```
- **Response 201 Created**:
```json
{
  "booking_id": "uuid-v4",
  "status": "CONFIRMED",
  "provider_id": "uuid-v4",
  "service_id": "uuid-v4",
  "contact_email": "string",
  "scheduled_slot": "string (ISO 8601 UTC)",
  "notes": "string | null",
  "created_at": "string (ISO 8601 UTC)"
}
```
- **Response 400 Bad Request**:
```json
{
  "statusCode": 400,
  "message": ["array of validation error strings"],
  "error": "Bad Request"
}
```
- **Response 404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Provider or Service ID does not exist",
  "error": "Not Found"
}
```
- **Response 429 Too Many Requests**:
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

---

## 3. Contract Pair B: Auth Service <-> Customer Bookings Dashboard

### Authentication Session Contract (Producer: Stream 3 / Ticket 04)
- **Login Path**: `POST /api/v1/auth/login`
- **Response 200 OK**:
```json
{
  "access_token": "string (JWT Signed with HMAC-SHA256)",
  "token_type": "Bearer",
  "expires_in": 900
}
```
- **JWT Payload Claims**:
```json
{
  "sub": "uuid-v4 (user id)",
  "email": "string (user email)",
  "iat": "integer (epoch seconds)",
  "exp": "integer (epoch seconds)"
}
```

---

### Authenticated Bookings Endpoint (Consumer: Stream 2 / Ticket 05)
- **Path**: `GET /api/v1/my-bookings`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response 200 OK**:
```json
{
  "data": [
    {
      "booking_id": "uuid-v4",
      "provider_name": "string",
      "service_title": "string",
      "scheduled_slot": "string (ISO 8601 UTC)",
      "status": "CONFIRMED | CANCELLED | COMPLETED",
      "created_at": "string (ISO 8601 UTC)"
    }
  ]
}
```

---

## 4. Synchronization Points & Boundary Enforcement
1. **Checkpoint 1 (DB Schema & Migration Alignment)**: Verify that `providers.id`, `services.id`, and `bookings.user_id` are consistently typed as `UUID` in PostgreSQL DDL before API controller development commences.
2. **Checkpoint 2 (Type & Path Conformance)**: Validate that `POST /api/v1/bookings` and `GET /api/v1/providers` compile against identical TypeScript interfaces (`src/common/interfaces/`).
3. **Checkpoint 3 (JWT Auth Extraction)**: Ensure `GET /api/v1/my-bookings` extracts `user_id` strictly from decoded `request.user.sub` populated by `JwtAuthGuard`.
