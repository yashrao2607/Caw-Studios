# Module 08: Automated Cross-Component Integration Test Plan

Standardized integration test suite executed on every pull request and staging deployment across multi-stream services.

---

## 1. Test Suite Architecture

```
                      +-----------------------------+
                      |   Test Harness (Jest/Vitest)|
                      +--------------+--------------+
                                     |
           +-------------------------+-------------------------+
           |                         |                         |
+----------v-----------+  +----------v-----------+  +----------v-----------+
| ICT-01: End-to-End   |  | ICT-02: State Sync   |  | ICT-03: Security &   |
| Multi-Role Corporate |  | & Slot Cancellation  |  | Atomic Concurrency   |
| Booking Flow         |  | Lifecycle            |  | Guard Verification   |
+----------------------+  +----------------------+  +----------------------+
```

---

## 2. Cross-Component Test Specifications

### Test ICT-01: Cross-Component Corporate Booking Flow
* **Components Involved:** `AuthService`, `CatalogService`, `BookingService`, `NotificationService`, `WebUI`.
* **Prerequisites:** Seeded Meridian corporate manager account (`manager_01`) and employee account (`emp_01`).
* **Execution Steps:**
  1. POST `/api/auth/login` with manager credentials -> assert valid JWT received with `company_id`.
  2. GET `/api/providers?category=engineering` -> select provider `p_42` and open slot `s_101`.
  3. POST `/api/bookings` with payload `{ provider_id: 'p_42', slot_id: 's_101', booked_for_name: 'Bob', booked_for_email: 'emp_01@meridian.com' }`.
* **Expected Result:**
  * HTTP 201 Created with booking ID.
  * Slot status transitions from `available` to `reserved` in DB.
  * Provider dashboard query returns booking with "Booked for Bob" metadata.
  * Notification service triggers dispatch event with ISO-8601 UTC timestamp.
* **Contracts Validated:** Interface Contract 01 (Delegated Booking Payload), Interface Contract 03 (Notification Event Schema).

---

### Test ICT-02: Booking Cancellation & Atomic Slot Reversion
* **Components Involved:** `BookingService`, `CatalogService`, `BillingService`, `NotificationService`.
* **Prerequisites:** Existing active booking `b_55` in `confirmed` status.
* **Execution Steps:**
  1. POST `/api/bookings/b_55/cancel` with authorization header.
  2. Query DB for booking record `b_55`.
  3. Query DB for slot associated with `b_55`.
  4. Query Billing Mock for refund transaction event.
* **Expected Result:**
  * Booking status equals `cancelled`.
  * Associated slot status resets to `available` and appears in public search.
  * Refund event registered for exact booking amount.
* **Contracts Validated:** Interface Contract 02 (State Synchronization & Cancellation Lifecycle).

---

### Test ICT-03: Concurrency Race & Atomic Double-Booking Protection
* **Components Involved:** `BookingService`, `Database Engine (PostgreSQL)`.
* **Prerequisites:** Target provider slot `s_99` set to `available`.
* **Execution Steps:**
  1. Spawn 50 concurrent asynchronous HTTP workers hitting `POST /api/bookings` for slot `s_99` with distinct user IDs.
  2. Collect all HTTP responses.
* **Expected Result:**
  * Exactly 1 request receives `HTTP 201 Created`.
  * Exactly 49 requests receive `HTTP 409 Conflict`.
  * Database contains exactly 1 booking record referencing `s_99`.
* **Contracts Validated:** Data Invariant 01 (Atomic Slot Exclusivity).
