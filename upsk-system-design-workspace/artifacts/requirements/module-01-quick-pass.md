# Module 01: Quick-Pass Requirements Warmup

## 1. Five Explicit Requirements
1. **Learner Discovery:** Learners can browse service providers filtered by category and view provider profiles with ratings.
2. **Booking & Payment:** Learners can book provider time slots and pay securely through the platform.
3. **Automated Confirmations:** The platform issues automated confirmation emails upon successful booking and payment capture.
4. **Provider Dashboard:** Providers can set availability, pricing, and service descriptions, and view active bookings, earnings, and reviews.
5. **Platform Commission:** The platform takes a 15% commission on all completed session earnings before provider payout.

## 2. Top Two Ambiguities
1. **Cancellation Refund Mechanics & Policy Rules:** Are provider cancellation policies freeform text or parameterized rule engines (e.g. 100% refund if >24h, 50% if >12h, 0% if <12h), and how is payment capture/escrow held?
2. **Double-Booking & Slot Hold Concurrency:** What is the atomic reservation lease duration during checkout (e.g., 5-minute optimistic lock), and how are conflicting simultaneous checkout attempts resolved?

## 3. Top Question for PM
- **Question:** *"How is provider payout and commission disbursement scheduled (e.g., automatic rolling 7-day post-session escrow release via Stripe Connect vs monthly batch bank transfer), and who absorbs payment processing fees (Stripe 2.9% + 30¢) on refunds?"*
