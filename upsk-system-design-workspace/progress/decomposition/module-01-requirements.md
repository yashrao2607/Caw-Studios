# Module 01: SkillSwap Extracted Requirements Specification

## 1. Categorized Requirements Matrix

### A. Learner Stakeholder Requirements
| ID | Requirement Statement | Type | Source | Confidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-LRN-01** | Learners can browse and filter verified providers by curated service category taxonomy. | Functional | Para 1 (Explicit) | High | APPROVED |
| **REQ-LRN-02** | Learners can view rich provider public profiles including aggregate ratings, verified reviews, bios, and hourly pricing. | Functional | Para 1 (Explicit) | High | APPROVED |
| **REQ-LRN-03** | Learners can select available provider time slots and complete checkout using credit card/digital payments. | Functional | Para 1 (Explicit) | High | APPROVED |
| **REQ-LRN-04** | The system automatically delivers booking confirmation emails with calendar invitations and session access details upon payment capture. | Functional | Para 1 (Explicit) | High | APPROVED |
| **REQ-LRN-05** | Learners can cancel confirmed bookings with automated refund calculations evaluated against cancellation policy rules. | Functional | Para 1 (Explicit) | Medium | **BLOCKED - Pending PM Decision (Contradiction Found)** |
| **REQ-LRN-06** | Search query and category filter latency must respond in under 200ms p95 ("feel instant") across target city datasets. | Quality Attribute | Para 1 (Explicit) | High | APPROVED |
| **REQ-LRN-07** | Learners must complete authentication (email/password or OAuth) before placing slot holds or initiating payments. | Constraint | Implicit | Medium | APPROVED |
| **REQ-LRN-08** | Learners can submit a 1-5 star rating and written review only after a booked session timestamp has elapsed. | Functional | Implicit | Medium | APPROVED |

---

### B. Provider Stakeholder Requirements
| ID | Requirement Statement | Type | Source | Confidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-PRV-01** | Providers can define custom recurring availability schedules, timezone offsets, and discrete bookable session slot lengths. | Functional | Para 2 (Explicit) | High | APPROVED |
| **REQ-PRV-02** | Providers can set base hourly/session pricing, service descriptions, and portfolio credentials. | Functional | Para 2 (Explicit) | High | APPROVED |
| **REQ-PRV-03** | Providers have an authenticated dashboard displaying upcoming bookings, historical earnings net of commission, and client reviews. | Functional | Para 2 (Explicit) | High | APPROVED |
| **REQ-PRV-04** | Providers can flag learner no-shows to trigger administrative review and protect payout eligibility. | Functional | Para 2 (Explicit) | High | APPROVED |
| **REQ-PRV-05** | Provider onboarding requires submission of identity/credentials for platform admin vetting before public listing. | Functional | Para 2 (Explicit) | High | APPROVED |
| **REQ-PRV-06** | 15% platform commission is automatically deducted from gross booking fees before escrow payout. | Constraint | Para 2 (Explicit) | High | APPROVED |
| **REQ-PRV-07** | Providers select or configure cancellation refund terms applicable to their bookings. | Constraint | Para 2 (Explicit) | Low | **BLOCKED - Pending PM Decision (Contradiction Found)** |

---

### C. Platform & Operations Stakeholder Requirements
| ID | Requirement Statement | Type | Source | Confidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-OPS-01** | Platform administrators can review provider vetting submissions, inspect credentials, and approve/reject marketplace listings. | Functional | Para 3 (Explicit) | High | APPROVED |
| **REQ-OPS-02** | Ops team has a dispute resolution console to review flagged cancellations, no-show disputes, and authorize discretionary refunds. | Functional | Para 3 (Explicit) | High | APPROVED |
| **REQ-OPS-03** | Telemetry and analytics pipeline records every transaction, search query, booking transition, and cancellation event. | Quality Attribute | Para 3 (Explicit) | High | APPROVED |
| **REQ-OPS-04** | Multi-tenant architecture and city schema abstraction must support expansion from 1 city to 5 cities within 6 months without schema redesign. | Quality Attribute | Para 3 (Explicit) | High | APPROVED |
| **REQ-OPS-05** | System must handle concurrency of thousands of active users per city without slot double-booking or race conditions. | Quality Attribute | Para 3 (Explicit) | High | APPROVED |
| **REQ-OPS-06** | Slot reservation checkout lock holds selected time slot for 5 minutes with atomic rollback on payment timeout or failure. | Constraint | Implicit | High | APPROVED |
| **REQ-OPS-07** | Automated payout engine disburses net provider earnings (85%) via automated batch transfer on a 7-day post-completion rolling window. | Functional | Implicit | Medium | APPROVED |

---

## 2. Injected Contradiction Analysis & Proposed Reconciliations

### Direct Spec Contradiction:
- **Original Spec (Para 1 & 2):** States that cancellations apply the *provider's individual cancellation policy*, granting providers autonomy over terms.
- **PM Clarification (Para 1):** Mandates a *universal platform policy* where all cancellations made within 24 hours of booking receive 100% refunds regardless of provider terms, and cancellations after 24 hours are strictly non-refundable.

### Proposed Implementable Options for PM Sign-off:
1. **Option 1: Universal Platform Policy with Zero Provider Overrides (Platform-First)**
   - *Rule:* 100% refund if canceled within 24h of purchase; 0% refund after 24h.
   - *Tradeoff:* Delivers extreme consistency and predictability for learners across all cities, but damages provider retention for high-demand instant/same-day bookings.
   - *Implementation Complexity:* Low. Single global timestamp assertion (`cancellation_time - booking_time <= 24h`).

2. **Option 2: Tiered Provider Policies with Statutory Platform Cooling-off Floor (Balanced)**
   - *Rule:* Platform enforces a universal 1-hour cooling-off window (100% refund if canceled within 60 mins of booking). Beyond 1 hour, providers choose from 3 standardized platform tiers relative to session start time (Flexible: 100% >24h; Moderate: 50% >24h; Strict: 100% >7d, 0% after).
   - *Tradeoff:* Protects accidental double-clicks/misbookings for learners while respecting provider schedule commitments.
   - *Implementation Complexity:* Medium. Requires tier enum on provider profiles and time-delta evaluation engine against session start time.

### Downstream Ripple Effects & Affected Subsystems:
- **Payment & Escrow Flow:** Dictates whether payments are held as authorizations or captured immediately with gateway refund API triggers.
- **Provider Dashboard & Projected Revenue:** Dictates whether booked revenue is marked "Guaranteed" or "Pending Refund Window".
- **Dispute Resolution Console:** Determines the automated vs manual override thresholds for ops admins.

### Architectural Tension Highlight:
- **Provider Calendar Autonomy vs. High Concurrency Booking:** Providers demand arbitrary granularity over slot durations, while platform concurrency demands fixed slot discretization and atomic database row locking (`SELECT FOR UPDATE` or Redis distributed lock) to prevent race conditions under load.
