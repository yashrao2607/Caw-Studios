# SkillSwap: Vertical Slices & Incremental Delivery Plan (Module 04 - Revised)

---

## 1. Stakeholder Tradeoff Response (To Product Manager)
> **From**: Lead Systems & Execution Architect  
> **To**: Product Manager  
> **Subject**: Re: Friday Investor Demo Scope & Payments Integration  
>
> "Hi team — I completely understand the investor's desire to see financial flow demonstrated live. However, expanding Slice 1 to couple full payment escrow directly into the initial booking flow would more than double the implementation scope (webhook handlers, state machines, refund edge cases), jeopardizing our Friday demo delivery.  
>
> **Recommended Solution (Decoupled Payment Spike - Slice 1.5)**:  
> 1. **Slice 1 (On Schedule)**: We demo the clean, end-to-end customer booking flow (browse -> select slot -> confirm).  
> 2. **Slice 1.5 (Standalone Payment Spike)**: We build a dedicated, lightweight Stripe Checkout test-mode page (`/demo/pay-provider`) proving money authorization and simulated bank transfer.  
> 
> **Why this works**: The investor sees a 100% working marketplace UX *and* live test-mode payments without risking an un-debugged monolith crash. If the investor insists on fully unified checkout in Demo 1, we must defer the Provider Profile page and multi-slot selection to absorb the scope without slipping the Friday deadline."

---

## Slice 1: Anonymous Browse & Instant Booking (Seeded Supply)
- **Objective**: Validate the core demand-side booking value proposition end-to-end on Day 1 without waiting for provider onboarding or payment gateways.
- **Scope (In)**:
  - Frontend: Display 3 static seeded provider cards (Name, Category, Hourly Rate, Fixed Star Rating).
  - Provider Detail View: Single service description with 3 static time slots (10:00 AM, 2:00 PM, 4:00 PM).
  - Booking Action: One-click "Book Now" submitting chosen provider ID, slot, and anonymous contact email.
  - Backend/DB: `POST /api/v1/bookings` writing directly to PostgreSQL `bookings` table.
  - On-Screen Confirmation: Renders confirmed Booking Reference ID, provider name, date/time, and status.
- **Anti-Scope (Explicitly Out)**:
  - ❌ No user registration or login (anonymous single-session checkout only).
  - ❌ No payment processing in this slice (handled via Slice 1.5 spike).
  - ❌ No email/SMS dispatch (confirmation displayed on-screen only).
  - ❌ No search, filtering, pagination, or geolocation radius.
  - ❌ No provider portal or dynamic availability calendar (slots are seeded).
  - ❌ No booking cancellation or rescheduling UI.
- **Dependencies**: None.
- **Estimated Complexity**: **S** (2–3 hours).

---

## Slice 1.5: Standalone Stripe Checkout Payment Spike (Test Mode)
- **Objective**: Provide a de-risked, functional demonstration of money authorization in Stripe test mode for the Friday investor demo without coupling payment state machines to the initial booking workflow.
- **Scope (In)**:
  - Endpoint: `POST /api/v1/payments/create-intent` creating a Stripe PaymentIntent ($50.00 USD) in test mode.
  - Demo UI (`/demo/pay-provider`): Minimal Stripe Elements card input accepting test card `4242...`.
  - Transaction Feedback: Live authorization confirmation showing Stripe Charge ID and status `succeeded`.
- **Anti-Scope (Explicitly Out)**:
  - ❌ No integration with `bookings` database table (standalone payment verification).
  - ❌ No webhook signature verification or background worker queue.
  - ❌ No multi-currency, payout splits, or platform fee calculations.
- **Dependencies**: None (Can run in parallel with Slice 1).
- **Acceptance Criteria**:
  1. Open `/demo/pay-provider` -> Enter test card details.
  2. Click "Authorize Payment ($50.00)" -> Stripe Elements processes payment.
  3. Green badge appears: "Payment Authorized - Charge ID: `ch_3M...`".
  4. Stripe Dashboard verifies test mode charge creation.
- **Estimated Complexity**: **S** (3 hours).

---

## Slice 2: User Identity & Authenticated Booking Management
- **Objective**: Introduce user identity, securing booking data and enabling customers to track active and past reservations.
- **Scope (In)**:
  - Authentication: User registration (`POST /api/v1/auth/register`) and login (`POST /api/v1/auth/login`) with JWT tokens stored in secure HttpOnly cookies.
  - Authenticated Checkout: Associates `user_id` foreign key with newly created bookings.
  - Customer Dashboard (`/my-bookings`): Displays list of user's active and completed bookings.
  - Basic Cancellation: Allows customer to cancel a booking in `CONFIRMED` state, updating DB status to `CANCELLED`.
- **Anti-Scope (Explicitly Out)**:
  - ❌ No social OAuth (Google/GitHub/Apple login).
  - ❌ No password reset / forgot password email flows.
  - ❌ No provider dashboard or provider-side login.
  - ❌ No automated cancellation penalty or refund calculation.
- **Dependencies**: Slice 1.
- **Estimated Complexity**: **S** (3–4 hours).

---

## Slice 3: Provider Self-Service & Dynamic Availability Management
- **Objective**: Unlock the supply-side marketplace, allowing real professionals to register, list customized services, and manage booking schedules.
- **Scope (In)**:
  - Provider Onboarding: Register as a provider, create profile bio, select category, and set hourly rates.
  - Service Definition: CRUD endpoints for services offered by the provider.
  - Availability Schedule: Set weekly availability windows (e.g. Mon-Fri 09:00–17:00).
  - Real-Time Slot Generation: Demand-side booking view dynamically computes available slots by subtracting existing bookings from provider schedule.
- **Anti-Scope (Explicitly Out)**:
  - ❌ No identity verification / background check upload pipeline.
  - ❌ No bank account payout onboarding (Stripe Connect).
  - ❌ No calendar sync (Google Calendar / iCal integration).
  - ❌ No recurring or multi-day slot booking.
- **Dependencies**: Slice 1, Slice 2.
- **Estimated Complexity**: **M** (1.5 days).

---

## Slice 4: Payment Escrow & Concurrency-Safe Booking Holds
- **Objective**: Integrate financial transaction processing with atomic database locking to prevent double-booking under high concurrency.
- **Scope (In)**:
  - Payment Integration: Full Stripe Elements integration holding authorized funds in escrow upon booking creation.
  - Atomic Slot Reservation: Database transaction with `SELECT ... FOR UPDATE` ensuring a slot cannot be double-booked.
  - Webhook Reconciliation: Stripe `payment_intent.succeeded` webhook transitions booking from `PENDING_PAYMENT` to `CONFIRMED`.
  - Automatic Release on Abandonment: 15-minute Redis TTL expiration releasing unconfirmed slot holds.
- **Anti-Scope (Explicitly Out)**:
  - ❌ No split payments, tip calculations, or multi-currency conversion.
  - ❌ No promo codes or discount coupon engine.
- **Dependencies**: Slice 1, Slice 1.5, Slice 2, Slice 3.
- **Estimated Complexity**: **M** (1.5 days).

---

## Slice 5: Post-Service Settlement, Verified Reviews & Notifications
- **Objective**: Close the marketplace feedback and settlement loop with transactional notifications and verified customer ratings.
- **Scope (In)**:
  - Service Completion & Payout: Provider marks booking `COMPLETED`, triggering Stripe transfer release to provider account.
  - Verified Reviews: Only customers with `COMPLETED` bookings can submit a 1–5 star rating and written review.
  - Aggregate Rating Recalculation: Updates provider profile average rating and review counter upon submission.
  - Email Notifications: Transactional emails for booking confirmation, 24h reminder, and completion review prompt.
- **Anti-Scope (Explicitly Out)**:
  - ❌ No dispute arbitration portal or chargeback resolution dashboard.
  - ❌ No photo/video attachments in reviews.
- **Dependencies**: Slice 1, Slice 2, Slice 3, Slice 4.
- **Estimated Complexity**: **M** (1 day).
