# TICKET-05: GET /api/v1/my-bookings & DELETE /:id — Customer Dashboard

## 1. Title
`[API] Implement Authenticated Customer Bookings Dashboard & Cancellation Endpoints`

## 2. Context (Why)
Enables registered customers in Slice 2 to view their active/past reservations and cancel bookings when plans change.

## 3. Scope (What)
- Implement `GET /api/v1/my-bookings` protected by `JwtAuthGuard` returning user's bookings.
- Implement `DELETE /api/v1/my-bookings/:id` allowing a user to cancel their own booking (updates `status = 'CANCELLED'`).
- Ensure strict IDOR protection (users cannot view or cancel bookings belonging to other users).

## 4. Interface Contract (Inputs/Outputs/Data Shapes)
### HTTP Requests
#### 1. List User Bookings (`GET /api/v1/my-bookings`)
- **Headers**: `Authorization: Bearer <jwt>`
- **200 OK**:
```json
{
  "data": [
    {
      "booking_id": "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
      "provider_name": "Maria Gomez",
      "service_title": "Deep Clean Service",
      "scheduled_slot": "2026-09-01T10:00:00.000Z",
      "status": "CONFIRMED",
      "created_at": "2026-08-17T14:45:00.000Z"
    }
  ]
}
```

#### 2. Cancel Booking (`DELETE /api/v1/my-bookings/:id`)
- **Headers**: `Authorization: Bearer <jwt>`
- **200 OK**: `{ "success": true, "message": "Booking successfully cancelled", "status": "CANCELLED" }`
- **403 Forbidden**: `{ "statusCode": 403, "message": "You do not have permission to cancel this booking" }`
- **404 Not Found**: `{ "statusCode": 404, "message": "Booking not found" }`

## 5. Acceptance Criteria (Given / When / Then)
- **Scenario 1: Authenticated User Views Own Bookings**
  - **Given** a logged-in user with 2 bookings.
  - **When** calling `GET /api/v1/my-bookings` with valid JWT.
  - **Then** status 200 is returned with exactly their 2 bookings.
- **Scenario 2: Cancellation of Own Booking**
  - **Given** an active booking owned by User A.
  - **When** User A calls `DELETE /api/v1/my-bookings/:id`.
  - **Then** status 200 is returned and database shows `status = 'CANCELLED'`.
- **Scenario 3: IDOR Prevention**
  - **Given** a booking owned by User A.
  - **When** User B attempts `DELETE /api/v1/my-bookings/:id` for User A's booking.
  - **Then** status 403 Forbidden is returned and database status remains unchanged.

## 6. Constraints
- Framework: NestJS with `@UseGuards(JwtAuthGuard)`.
- SQL Query: Include `WHERE user_id = :userId` in delete/update query to prevent race conditions.

## 7. Anti-Scope
- ❌ No provider-side dashboard.
- ❌ No automated refund or penalty logic.
- ❌ No email cancellation notifications.
