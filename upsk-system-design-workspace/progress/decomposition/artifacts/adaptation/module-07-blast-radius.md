# Module 07: Blast Radius Analysis & Scope Triage

**Change Triggers:**
1. **Business Pivot:** Meridian Corp pilot requirement for Company Accounts booking on behalf of employees.
2. **Timeline Constraint:** Delivery compressed to 6 days ahead of the critical Investor Demo.

---

## 1. Blast Radius Matrix: Company Accounts (Booking on Behalf)

| Component / Artifact | Status | Impact Classification | Blast Radius & Technical Impact Detail |
| :--- | :--- | :--- | :--- |
| **User Data Model** | `IN PROGRESS` | `MINOR` | Add `company_name: string?` and `can_book_for_others: boolean` flags to `users` schema. |
| **Auth & JWT System** | `DONE` | `NO IMPACT` | JWT token payload remains unchanged; `can_book_for_others` claims are resolved on demand via user query. |
| **Booking Flow (API)** | `NOT STARTED` | `MAJOR` | Update `POST /bookings` contract to accept `booked_for_name` and `booked_for_email` when requester has `can_book_for_others=true`. Add validation and return delegated entity metadata in response payload. |
| **Booking Flow (UI)** | `NOT STARTED` | `MAJOR` | Add dynamic conditional delegation section ("Who is this booking for?") on the confirmation step when corporate delegate mode is active. |
| **Provider Dashboard** | `NOT STARTED` | `MINOR` | Display "Booked by [Manager Name] for [Employee Name]" on provider upcoming session cards. |
| **Search & Listing** | `DONE` | `NO IMPACT` | Listing, geolocation, and base category filtering remain unchanged. |
| **Payment & Billing** | `NOT STARTED` | `MINOR` | Bill booking directly to the corporate account holder's registered payment method (internal corporate expense flow). |
| **Stream Contracts** | `DONE` | `MINOR` | Extend Interface Contract 01 (Booking Payload Schema) with nullable delegation fields. |
| **Tickets: Completed** | `DONE` | `NO IMPACT` | User auth and base provider catalog tickets remain valid without modification. |
| **Tickets: In Progress**| `IN PROGRESS` | `MINOR` | User profile update PR modified to include company metadata fields. |
| **Tickets: Unstarted** | `NOT STARTED` | `MAJOR` | 3 unstarted tickets restructured into minimal corporate bridge scope. |

---

## 2. Timeline Compression Triage (6-Day Investor Demo Scope)

| Ticket / Capability | Classification | Rationale & Tradeoff Justification |
| :--- | :--- | :--- |
| **Individual Booking & Checkout** | `MUST SHIP` | Core demo value proposition; without checkout, marketplace loop fails. |
| **Corporate Booking on Behalf** | `MUST SHIP` | Required to unblock Meridian Corp $120k contract and highlight enterprise expansion. |
| **Provider Session Confirmation** | `MUST SHIP` | Closes the two-sided marketplace loop for demo attendees. |
| **Email / SMS Reminders** | `SHOULD SHIP` | Useful for demo realism; fallback to in-app notification banner if 3rd-party webhook lags. |
| **Advanced Multi-Filter Search** | `CUT` | Base category and keyword search is fully functional; faceted filter matrix deferred to Sprint 13. |
| **Provider Analytics & Earnings Dashboard**| `CUT` | Providers can see raw upcoming booking cards; aggregated historical charts deferred to Phase 2. |
| **Automated Invoicing & Tax Calculation**| `CUT` | Standard Stripe receipt is sufficient for investor demo; corporate PDF batch invoicing deferred. |
