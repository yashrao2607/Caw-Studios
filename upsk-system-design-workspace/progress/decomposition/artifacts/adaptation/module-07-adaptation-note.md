# Module 07: Revised Stakeholder Impact Statement (v2 Layering)

**To:** Product Management & Executive Leadership  
**From:** Lead Systems Architect  
**Date:** 2026-08-18 (15:30 UTC Revision)  
**Subject:** REVISED: 6-Day Delivery Scope Incorporating Meridian 3-Tier Corporate RBAC  

---

### Revised Scope Assessment & Transparent Tradeoffs

In our message 15 minutes ago, we committed to basic company booking delegation within the 6-day investor demo window. Following the latest requirement from Meridian IT regarding strict role separation (Managers, Employees, and Department Heads), here is our revised delivery plan:

1. **How We Absorbed the Role Architecture:** Rather than a disposable single-user toggle, we have structured an explicit 3-role model (`manager`, `employee`, `department_head`) directly into our user schema and API middleware. This avoids throwaway rework and natively satisfies Meridian IT's security constraints.
2. **What Ships for the Demo (Day 6):**
   * Managers booking on behalf of team employees with live schedule badging.
   * Employee restriction enforcement (403 if employees attempt to delegate bookings).
   * Department head visibility into aggregated departmental bookings.
3. **What Stays Cut:** Faceted search and historical revenue analytics remain deferred to Sprint 13.
4. **Schedule Margin & Risk:** Absorbing role validation utilizes all available buffer time on Days 3–4. The demo is 100% viable provided schema migrations lock by tomorrow at 10:00 UTC.
5. **Immediate Ask from PM:** Please confirm that Meridian's pilot only requires 3 specific roles (Manager, Employee, Dept Head) and no custom fine-grained permission matrices before tomorrow morning's migration freeze.
