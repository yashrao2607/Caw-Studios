# Postmortem: Silent Order Ingestion Drop during OrderProcessor v2.14 Release

- **Incident Date**: Wednesday, October 15, 2025
- **Incident Period**: 14:00 UTC – 16:02 UTC (Total Duration: 2 hours 2 minutes)
- **Impact Duration**: 14:00 UTC – 15:34 UTC (94 minutes of dropped order persistence)
- **Severity**: SEV-1 (Critical Business Impact)
- **Facilitator / Author**: Senior Reliability & Communications Engineer
- **Status**: Complete & Action Items Assigned

---

## 1. Executive Summary

On Wednesday, October 15, 2025, between 14:00 UTC and 15:34 UTC, the `OrderProcessor` service silently failed to persist 1,400 checkout orders ($186,000 in GMV) following the deployment of release `v2.14`. While customer payment cards were successfully charged by the upstream payment gateway, a broad exception handler caught a missing deprecated configuration property (`warehouse_routing`), logged a `DEBUG`-level warning, and returned HTTP `200 OK` to the frontend without writing the order record to the primary database. Because health check probes and dashboards monitored only HTTP status codes (99.9% 200s) and CPU/memory, automated alerting did not trigger. Detection occurred 38 minutes post-deploy via customer support ticket volume, and mitigation was delayed by 32 minutes due to stale artifact paths in the automated rollback script. All 1,400 dropped orders were reconciled and backfilled from payment gateway transaction logs by 16:02 UTC with zero permanent financial loss.

---

## 2. Detailed Incident Timeline

| Time (UTC) | Duration | Elapsed | Event / State Transition |
| :--- | :--- | :--- | :--- |
| **14:00** | -- | 00:00 | **Deployment**: `OrderProcessor v2.14` deployed to production, removing the deprecated `warehouse_routing` config field. |
| **14:00–14:22** | 22m | 00:22 | **Silent Failure**: Service returns HTTP `200 OK` for all checkouts. Health checks report green. 0 orders written to DB. |
| **14:22** | -- | 00:22 | **First User Signal**: Customers post on social media and submit support tickets regarding missing confirmation emails. |
| **14:23–14:38** | 15m | 00:38 | **Triage Delay**: Customer support escalates in `#cs-escalations`. Incident is initially triaged as a benign email delivery delay. |
| **14:38** | -- | 00:38 | **Investigation Begins**: Second wave of support tickets prompts active on-call investigation. |
| **14:42** | 4m | 00:42 | **Dashboard False-Negative**: On-call inspects HTTP metrics; response codes (200 OK), p99 latency (42ms), CPU/RAM normal. |
| **14:55** | 13m | 00:55 | **Impact Verified (TTD)**: Direct SQL query confirms zero new rows in `orders` table since 14:00 deploy. |
| **15:02** | 7m | 01:02 | **Root Cause Localized**: Deploy `v2.14` identified as trigger. Automated rollback initiated. |
| **15:08** | 6m | 01:08 | **Rollback Failure**: Automated rollback fails due to outdated artifact storage paths from prior infrastructure migration. |
| **15:15** | 7m | 01:15 | **Escalation**: On-call escalates to Platform Engineering for manual container image rollback. |
| **15:34** | 19m | 01:34 | **Mitigation Completed (TTM)**: Platform team completes manual rollback to `v2.13`. New checkout orders write successfully. |
| **15:45** | 11m | 01:45 | **Data Reconciliation**: Data Engineering initiates automated script replaying 1,400 orders from payment logs. |
| **16:02** | 17m | 02:02 | **Full Resolution (TTR)**: All 1,400 orders persisted, inventory reserved, confirmation emails dispatched. Incident resolved. |

---

## 3. Five-Whys Root Cause Analysis

1. **Why were customers charged without receiving confirmation emails or order records?**
   - The `OrderProcessor` service charged credit cards via the payment gateway but failed to execute the database `INSERT` statement for the order record.
2. **Why was the order database insert not executed?**
   - An internal configuration lookup for `warehouse_routing` threw a `KeyNotFoundException` during the fulfillment routing calculation step.
3. **Why did the service return HTTP 200 OK if an exception was thrown?**
   - The checkout controller contained a blanket `catch (Exception e)` block that swallowed unexpected routing errors, logged them at `DEBUG` level, and returned a success response payload to avoid client retry storms.
4. **Why was the missing configuration field not detected in the staging environment?**
   - Staging and production configurations had drifted; the staging environment never configured `warehouse_routing`, masking the runtime dependency during pre-release testing.
5. **Why did automated alerts fail to notify engineering that zero orders were being processed?**
   - Monitoring relied exclusively on shallow HTTP transport telemetry (status codes and latency) rather than core domain business invariants (e.g. `orders_created_per_minute > 0`).

**Systemic Root Cause**:
The absence of domain-level business metric alerting, combined with defensive exception swallowing (returning HTTP 200 on internal write failure) and schema drift between staging and production environments, allowed a breaking configuration change to silently drop orders without triggering automated detection.

---

## 4. Contributing Factors

- **Surface-Level Health Checks & Telemetry**: Health checks verified only process liveness (`GET /health`), and monitoring dashboards lacked business metric widgets (Orders/min, Payments-to-Orders Conversion Ratio).
- **Untested Rollback Automation**: The automated rollback pipeline had not been verified since the cloud infrastructure migration 4 months prior, delaying rollback by 26 minutes.
- **Alert Triage Ambiguity**: Customer support escalation channels lacked standardized severity criteria to distinguish third-party webhook/email delays from critical checkout drop-offs.
- **Swallowed Error Visibility**: The missing configuration exception was logged at `DEBUG` level rather than `ERROR`, concealing the failure from log-anomaly detection systems.

---

## 5. Corrective and Preventative Action Items

| Item | Action Description | Responsible Role | Target Date | Definition of Done (DoD) |
| :--- | :--- | :--- | :--- | :--- |
| **ACT-01** | **Business Invariant Alerting**: Deploy Datadog anomaly monitor triggering P1 on-call pager if `orders_created_per_minute == 0` for > 3 minutes during business hours. | Observability Lead | 2025-10-24 | Alert fires in staging drill and routes directly to PagerDuty with runbook link. |
| **ACT-02** | **Refactor Checkout Error Handling**: Remove broad try/catch swallowing in `OrderProcessor`. Internal write failures must throw HTTP 500 and trigger payment refund/void workflows. | Core Checkout Lead | 2025-10-31 | Unit & integration tests verify HTTP 500 and structured error logs on database or routing failure. |
| **ACT-03** | **Automated Rollback Verification**: Repair CI/CD rollback pipeline and schedule weekly automated rollback tests against ephemeral staging environments. | Platform Infra Lead | 2025-10-28 | CI job executes automated rollback drill weekly and alerts in Slack on failure. |
| **ACT-04** | **Staging/Prod Configuration Parity**: Implement schema validation CI gate (`ajv` / Pydantic) ensuring all production config keys exist in staging before deployments merge. | Release Engineering | 2025-11-07 | CI step fails pull requests that introduce mismatched configuration schemas. |
| **ACT-05** | **Customer Support P1 Escalation Runbook**: Establish formal SLA and keyword-based escalation bot in Slack bridging CS alerts to on-call engineers. | Operations Lead | 2025-10-31 | Published runbook in `runbooks/cs-incident-escalation.md` with active Slack workflow. |

---

## 6. Lessons Learned

### What Went Well
- **Zero Financial / Order Loss**: Payment gateway transaction logs provided a durable, idempotent source of truth that allowed 100% of dropped orders ($186k) to be accurately reconstructed and backfilled within 30 minutes of rollback.
- **Rapid Manual Mitigation**: Once escalated, the platform team executed a clean manual container tag rollback in under 20 minutes.

### Where We Got Lucky
- **Payment Log Completeness**: Payment processor webhook metadata contained full customer and line-item snapshots; without this, manual outreach to 1,400 customers would have taken days.
- **Incident Timing**: The failure occurred on a Wednesday afternoon during staffed business hours rather than over a weekend.

### What We Will Do Differently
- **Monitor Business Invariants, Not Just HTTP Codes**: We will never consider a service "healthy" solely because it returns HTTP 200; health must be proven by successful domain state transitions.
- **Test Rollbacks Continuously**: Rollback pipelines must be treated as critical production paths and tested on every release cycle.
