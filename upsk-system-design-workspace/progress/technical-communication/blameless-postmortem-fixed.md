# Incident Postmortem (Blameless & Systemic): OrderProcessor Silent Ingestion Drop

- **Incident Date**: Wednesday, March 15, 2025
- **Impact Duration**: 14:00 UTC – 15:34 UTC (94 minutes)
- **Total Resolution Time**: 14:00 UTC – 16:02 UTC (2 hours 2 minutes)
- **Severity**: SEV-1 (Silent Data Loss & Financial Impact)
- **Facilitator**: Reliability & Quality Lead
- **Status**: Complete & Remediations Scheduled

---

## 1. Executive Summary

On Wednesday, March 15, 2025, between 14:00 UTC and 15:34 UTC, the `OrderProcessor` service silently failed to persist 1,400 checkout orders ($186,000 GMV) following the deployment of release `v2.14`. While customer payment cards were charged by the upstream payment processor, the service caught an unexpected missing configuration exception (`warehouse_routing`) in a broad `try/catch` handler, logged the warning at `DEBUG` level, and returned HTTP `200 OK` to clients without writing the order to the database. Automated alerts did not fire because monitoring verified only HTTP status codes (100% 200s) and CPU/RAM metrics rather than business domain invariants. The issue was identified via customer support escalations, and rollback was delayed by 26 minutes due to untested post-migration artifact paths. All 1,400 orders were backfilled from payment transaction logs by 16:02 UTC with zero permanent data or financial loss.

---

## 2. Chronological Timeline

- **14:00 UTC**: `OrderProcessor v2.14` deployed to production, removing the deprecated `warehouse_routing` configuration key.
- **14:00–14:22 UTC**: Service returns HTTP 200 for all checkouts. 0 orders written to DB. Health checks report green.
- **14:22 UTC**: First user signal received via customer support tickets regarding missing confirmation emails.
- **14:23–14:38 UTC**: Escalated in `#cs-escalations`. Triage initially assumed a benign third-party email delivery delay based on past heuristics.
- **14:38 UTC**: Increased support volume prompts active on-call investigation.
- **14:42 UTC**: On-call responder inspects telemetry; HTTP status codes, error rates (<0.01%), and latency dashboards show normal baseline.
- **14:55 UTC (TTD)**: Direct database audit reveals zero new records in `orders` table since 14:00.
- **15:02 UTC**: Deploy `v2.14` identified as trigger. Automated rollback initiated.
- **15:08 UTC**: Automated rollback fails due to outdated artifact paths referencing legacy infrastructure.
- **15:15 UTC**: On-call escalates to Platform Engineering for manual container tag rollback.
- **15:34 UTC (TTM)**: Manual rollback to `v2.13` completed. Order persistence restored.
- **15:45 UTC**: Data Engineering runs automated backfill script replaying 1,400 orders from payment processor logs.
- **16:02 UTC (TTR)**: All 1,400 orders persisted, inventory reserved, and confirmation emails dispatched. Incident resolved.

---

## 3. Five-Whys Systemic Root Cause Analysis

1. **Why were orders dropped silently?**
   - The checkout handler charged customer cards but bypassed the database `INSERT` call.
2. **Why was the database insert bypassed?**
   - The order routing module threw a `KeyNotFoundException` when attempting to read the removed `warehouse_routing` configuration field.
3. **Why did the service return HTTP 200 OK when an exception occurred?**
   - A defensive top-level `catch (Exception e)` block suppressed the runtime failure, emitted a `DEBUG`-level log, and returned a success payload to prevent client-side retry storms.
4. **Why did pre-release testing in the staging environment fail to catch the error?**
   - Staging and production configuration schemas had drifted; staging never contained the `warehouse_routing` key, masking the runtime code dependency during verification.
5. **Why was the outage not detected immediately by automated monitoring?**
   - Monitoring relied strictly on transport-layer signals (HTTP 200s and CPU/RAM) with zero business invariant monitors (e.g. `orders_created_per_minute > 0`).

**Systemic Root Cause**:
Defensive exception swallowing returning false HTTP 200s, combined with staging/production configuration schema drift and the lack of business-level invariant alerts, allowed a configuration removal to silently drop order persistence without triggering automated failure detection.

---

## 4. Contributing Factors

- **Surface-Level Telemetry**: Health checks inspected only process uptime; no alerts monitored the ratio of successful charges to created orders.
- **Untested Rollback Automation**: Infrastructure migrations 4 months prior updated artifact repositories without updating rollback automation scripts or running verification drills.
- **Ambiguous Escalation Channels**: Customer support escalation channels lacked structured severity criteria to differentiate notification delivery delays from checkout failures.
- **Low-Severity Log Masking**: Critical routing failure exceptions were logged at `DEBUG` level instead of `ERROR`, evading log-anomaly tripwires.

---

## 5. Corrective & Systemic Action Items

| ID | Systemic Remediation Action | Owner Role | Target Date | Definition of Done (DoD) |
| :--- | :--- | :--- | :--- | :--- |
| **ACT-01** | **Business Invariant Alerting**: Deploy Datadog monitor alerting on-call pager if `orders_created_per_minute == 0` for > 3 minutes during peak hours. | Observability Lead | 2025-03-22 | Alert tested in staging drill and routes directly to PagerDuty. |
| **ACT-02** | **Fail-Fast Error Handling**: Refactor checkout handler to eliminate exception swallowing. Database or routing failures must return HTTP 500 and trigger automatic payment voiding. | Core Backend Lead | 2025-03-29 | Unit tests verify HTTP 500 returned and structured error logged on missing config or DB drop. |
| **ACT-03** | **Automated Rollback Verification**: Repair CI/CD rollback pipeline and schedule automated weekly rollback verification drills in staging. | Platform Infra Lead | 2025-03-26 | Automated weekly pipeline run succeeds and posts confirmation in `#infra-deployments`. |
| **ACT-04** | **Config Schema Validation Gate**: Implement CI step using JSON schema validation to guarantee 100% configuration key parity between staging and production. | Release Engineering | 2025-04-05 | CI build fails pull requests that introduce mismatched configuration schemas. |
| **ACT-05** | **Structured CS Escalation Bot**: Deploy Slack workflow in `#cs-escalations` with mandatory issue-type categorization and automated PagerDuty triggers for checkout anomalies. | Support Operations | 2025-03-29 | Workflow active and documented in `runbooks/cs-escalation.md`. |

---

## 6. Lessons Learned

### What Went Well
- **Idempotent Audit Trail**: Upstream payment processor transaction metadata served as a complete, durable backup, enabling 100% order recovery within 30 minutes of rollback.
- **Clear Rollback Escalation**: Once manual intervention was requested, Platform Engineering completed container rollback in under 20 minutes.

### Systemic Takeaways
- **Health Must Reflect Business Outcomes**: A service cannot be deemed healthy based on HTTP 200 status codes alone; monitoring must validate core business transactions.
- **Rollback Is a First-Class Feature**: Rollback automation must be tested continuously as part of routine CI/CD health verification.
