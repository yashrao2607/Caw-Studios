# TICKET-03: POST /api/v1/bookings — Create Anonymous Booking (AI-Ready - Hardened)

## 1. Title
`[API] POST /api/v1/bookings — Create Anonymous Short-Term Booking Endpoint`

## 2. Context (Why)
Serves as the central transaction point for demand-side conversion in Slice 1. Allows prospective customers to select a time slot and lock in a booking with immediate on-screen confirmation without mandatory account creation.

## 3. Scope (What)
- Implement endpoint `POST /api/v1/bookings`.
- Create DTO validation using `class-validator` (`provider_id`, `service_id`, `contact_email`, `scheduled_slot`, optional `notes`).
- Enforce idempotency via `Idempotency-Key` HTTP header.
- Apply rate limiting (max 10 requests per minute per IP).
- Insert booking row into PostgreSQL `bookings` table with status `CONFIRMED`.
- Emit structured audit log on successful creation.
- Return generated `booking_id` and summary details.

## 4. Interface Contract (Inputs/Outputs/Data Shapes)
### HTTP Request
- **Method**: `POST`
- **Path**: `/api/v1/bookings`
- **Headers**:
  - `Content-Type: application/json`
  - `Idempotency-Key: <UUIDv4>` (Optional, but recommended for client network retry safety)
- **Body**:
```json
{
  "provider_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "service_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
  "contact_email": "customer@example.com",
  "scheduled_slot": "2026-09-01T10:00:00.000Z",
  "notes": "Please ring back doorbell upon arrival."
}
```

### HTTP Responses
#### 201 Created (or 200 OK for Idempotent Replay)
```json
{
  "booking_id": "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
  "status": "CONFIRMED",
  "provider_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "service_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
  "contact_email": "customer@example.com",
  "scheduled_slot": "2026-09-01T10:00:00.000Z",
  "notes": "Please ring back doorbell upon arrival.",
  "created_at": "2026-08-17T14:45:00.000Z"
}
```
#### 400 Bad Request (Validation Failure / Malformed Inputs)
```json
{
  "statusCode": 400,
  "message": [
    "provider_id must be a UUID",
    "contact_email must be an email",
    "scheduled_slot must be a valid ISO 8601 date string",
    "notes must not contain HTML tags and must be under 500 characters"
  ],
  "error": "Bad Request"
}
```
#### 404 Not Found (Invalid Provider or Service ID)
```json
{
  "statusCode": 404,
  "message": "Provider or Service ID does not exist",
  "error": "Not Found"
}
```
#### 429 Too Many Requests (Rate Limit Exceeded)
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```
#### 500 Internal Server Error (Sanitized Production Error)
```json
{
  "statusCode": 500,
  "message": "An unexpected error occurred while processing your booking",
  "error": "Internal Server Error"
}
```

## 5. Acceptance Criteria (Given / When / Then)
- **Scenario 1: Valid Booking Submission**
  - **Given** existing provider and service IDs in database.
  - **When** a client posts a valid payload to `/api/v1/bookings`.
  - **Then** the server responds with HTTP 201 Created containing a unique `booking_id`, `status: 'CONFIRMED'`, and emits an audit log event `{ event: 'BOOKING_CREATED', booking_id: '...' }`.
- **Scenario 2: Idempotent Retried Request**
  - **Given** a successful booking request previously completed with `Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`.
  - **When** the client resends the exact request with the identical `Idempotency-Key`.
  - **Then** the server returns the cached 200/201 response with the original `booking_id` without creating a duplicate database record.
- **Scenario 3: Rate Limiting Enforcement**
  - **Given** an IP address sending requests.
  - **When** sending more than 10 requests within a 60-second window.
  - **Then** the 11th request receives HTTP 429 Too Many Requests.
- **Scenario 4: Notes XSS Sanitization**
  - **Given** a request containing `<script>alert(1)</script>` in the `notes` field.
  - **When** submitting the request.
  - **Then** the HTML tags are stripped or rejected with HTTP 400 Bad Request.

## 6. Constraints
- Framework: NestJS with `@UseGuards(ThrottlerGuard)` and `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
- Database: Atomic transaction verifying foreign keys before insert.
- Error Masking: Global `HttpExceptionFilter` stripping database error stacks from 500 responses in non-local environments.
- Logging: Use NestJS structured logger formatting logs as JSON.

## 7. Anti-Scope
- ❌ No payment processing or credit card collection (deferred to Slice 1.5/4).
- ❌ No email/SMS dispatch (on-screen confirmation only).
- ❌ No user authentication required (anonymous single-session checkout).
- ❌ No dynamic availability collision checking (static seeded slots in Slice 1).
