# Rewritten Executive Memo: Upgrading Traffic Infrastructure Before Black Friday

**To:** Sarah (VP of Engineering), David (Head of Product)  
**From:** Marcus (Platform Engineering Lead)  
**Date:** August 18, 2026  
**Subject:** Proposal: 8-Week Traffic Infrastructure Upgrade to Prevent Black Friday Checkout Slowdowns  

---

### Executive Summary

We are requesting approval to allocate **2 platform engineers for 8 weeks in Q3** to upgrade our core website traffic routing system. This upgrade will protect our checkout experience from traffic spikes during Black Friday and replace legacy routing software that reached end-of-support this year.

---

### Why This Matters for the Business

During last November's Black Friday sale, customer traffic surged to our system's maximum capacity. Our checkout system slowed down dramatically, causing **47 minutes of degraded service and missed customer purchases**. 

With projected 25% year-over-year customer growth this holiday season, our current traffic routing setup will fail under peak load. Upgrading now ensures our website handles 2x our previous peak traffic with zero slowdowns.

---

### Proposed Plan & Resource Impact

* **The Upgrade:** We will replace our aging routing layer with a modern, high-capacity traffic management system that integrates directly with our cloud clusters.
* **Timeline & Staffing:** 8 weeks during Q3 (August 1 to September 25), staffed by 2 platform engineers.
* **Customer Impact:** Zero customer-facing downtime. We will run both systems in parallel and switch traffic seamlessly once verification is complete.
* **Roadmap Tradeoff:** These 2 engineers will be dedicated full-time to infrastructure reliability, pausing non-critical platform feature requests during August and September.

---

### Key Risks & Mitigation

1. **Server Capacity Headroom (Primary Risk):** The new system requires approximately 15% more server memory across our cloud cluster. If our server pool runs out of memory during a sudden traffic spike, the system could slow down similarly to last Black Friday.
   * **Mitigation:** We will run simulated 2x holiday load tests in late August. If memory headroom is insufficient, we will resize the node pool before cutting over.
2. **Performance Parity:** If the new system does not outperform the old one during staging load tests, we will roll back immediately to our current setup without impacting production.

---

### What We Need From Leadership

To proceed with the Q3 schedule, we need three specific approvals by **Friday, August 22**:

1. **Staffing Sign-Off (Sarah):** Approval to allocate 2 platform engineers for 8 weeks.
2. **Roadmap Alignment (David):** Confirmation that pausing platform feature requests for 8 weeks does not conflict with upcoming Q3 product commitments.
3. **Capacity Budget Approval (Sarah & David):** Approval for an estimated $1,200/month cloud memory buffer to ensure adequate headroom during holiday load testing.
