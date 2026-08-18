# Module 07: Layered Execution Plan (Version 3 — Corporate RBAC & Compressed Timeline)

**Milestone:** 6-Day Investor Demo & Meridian Enterprise Gate  
**Evolution History:**  
* v1: Base Module 06 parallel execution DAG.  
* v2: Initial Corporate Bridge (single booking-on-behalf toggle).  
* v3 (Current): Layered 3-Tier Corporate RBAC (`manager`, `employee`, `department_head`).  

---

## 1. Data Model & Authorization Invariant Specification

To absorb Meridian IT's 3-role governance without delaying the 6-day investor demo, we upgrade from a simple boolean flag to an explicit role enum and department reference on the user model:

```sql
-- Schema Migration: Corporate RBAC Addition
ALTER TABLE users 
  ADD COLUMN company_id VARCHAR(64) NULL,
  ADD COLUMN department_id VARCHAR(64) NULL,
  ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'individual'; -- 'individual' | 'employee' | 'manager' | 'department_head'

CREATE INDEX idx_users_corp ON users (company_id, department_id, role);
```

### Authorization Rules:
1. **Manager:** Can invoke `POST /bookings` with `booked_for_user_id` for any employee within their `company_id`.
2. **Employee:** Can only book for themselves. Attempting to provide `booked_for_user_id` returns `403 Forbidden: Employees cannot delegate bookings`.
3. **Department Head:** Can view all booking records where `booking.user.department_id === caller.department_id` via `GET /company/department/bookings`.

---

## 2. Layered Ticket Breakdown

| Ticket ID | Status | Scope Description | Owner Stream | Estimate |
| :--- | :--- | :--- | :--- | :--- |
| **TICKET-01** | `DONE` | User Auth & JWT Token Issuance | Stream A | 1.0 D |
| **TICKET-02** | `DONE` | Provider Catalog & Base Geolocation Search | Stream B | 1.0 D |
| **TICKET-03** | `DONE` | Provider Profile & Rate Card View | Stream B | 0.5 D |
| **TICKET-11** | `ACTIVE` | Corporate RBAC Schema (`users.role`, `department_id`) | Stream A | 0.5 D |
| **TICKET-04** | `READY` | Booking API with Role Guard (`requireCorporateManager`) | Stream A | 1.0 D |
| **TICKET-05** | `READY` | Booking UI with Role-Aware Delegation Field | Stream B | 1.0 D |
| **TICKET-12** | `READY` | Provider & Dept Head Dashboard Booking Views | Stream B | 1.0 D |
| **TICKET-13** | `READY` | End-to-End Multi-Role Corporate Booking Smoke Tests | Shared | 1.0 D |

---

## 3. Explicit Descope (Preserving 6-Day Demo Integrity)
* **CUT-01:** Advanced Faceted Search (Basic search fully functional).
* **CUT-02:** Historical Revenue & Analytics Dashboards (Upcoming schedule lists active).
* **CUT-03:** Automated PDF Invoicing (Standard Stripe card capture active).
