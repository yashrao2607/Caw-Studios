# Design Document (Revised): Event Processing Pipeline

- **Author**: Jamie Chen (revised with Senior Peer Review)
- **Date**: March 15, 2025
- **Status**: Ready for Review
- **Target Audience**: Core API, Platform Infrastructure, and Data Engineering

---

## 1. Problem Statement

Our API currently processes user activity events (page views, clicks, purchases) synchronously inside the HTTP request loop. This adds 150–300ms of unneeded latency to every customer request. At our peak traffic of 2,000 events/second, synchronous event handling exhausts Node.js event loop workers, degrades user experience, and threatens database connection pools. We must extract event ingestion out of the synchronous request path.

---

## 2. Proposed Approach: Apache Kafka Event Bus

API servers publish events asynchronously (<5ms latency) to Apache Kafka topics. Dedicated downstream consumer worker groups consume and process events in micro-batches before persisting them to the analytics data warehouse.

```
API Request ──► Async Publish (<5ms) ──► Kafka (3 Brokers, RF=3)
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               ▼                                                               ▼
Pageviews Consumer (Auto-scaled)                                Purchases Consumer (Keyed by `user_id`)
               │                                                               │
               ▼                                                               ▼
 Micro-batch write (500 events)                                   Micro-batch write (50 events)
               │                                                               │
               └───────────────────────────────┬───────────────────────────────┘
                                               ▼
                                 Analytics Database (ClickHouse / Timescale)
```

---

## 3. Alternatives Considered

| Dimension | Option A: Apache Kafka (Proposed) | Option B: Managed AWS SQS + SNS | Option C: Redis Streams + In-Memory BullMQ |
| :--- | :--- | :--- | :--- |
| **Description** | Distributed partitioned log broker (3 nodes) with consumer group offsets. | Fully managed AWS queue service with native dead-letter queues. | In-memory append-only log running on our existing Redis cluster. |
| **Pros** | • High write throughput (100k+ msg/sec).<br>• Replayable event history (7-day retention).<br>• Partition-level key ordering by `user_id`. | • Zero broker maintenance or infrastructure patching overhead.<br>• Native per-message visibility timeout and automated DLQ retries. | • Zero new infrastructure (uses existing Redis cluster).<br>• Sub-millisecond latency.<br>• Simplest local developer ergonomics. |
| **Cons** | • High operational complexity (broker clustering, partition management).<br>• Steep learning curve for consumer rebalance protocols. | • Lacks replayability once messages are acknowledged.<br>• Higher variable cost at 50M+ events/day ($0.40 / million requests). | • RAM bounded (expensive to retain multi-day backlogs in memory).<br>• Risk of memory pressure during extended downstream database outages. |
| **Why Not Chosen** | **Selected**: Meets multi-day event replay requirements and predictable high-volume cost efficiency. | **Rejected**: Inability to replay historical events for backfilling analytics models without re-ingesting raw data. | **Rejected**: Memory cost of storing 7-day event logs in Redis RAM is economically unfeasible compared to disk-backed Kafka logs. |

---

## 4. Risks and Actionable Mitigations

| Risk | Metric & Trigger Threshold | Concrete Action Plan & Runbook | Responsible Party & SLA |
| :--- | :--- | :--- | :--- |
| **Kafka Broker Cluster Failure** | API Kafka Producer error rate > 0.5% for 60s or connection timeout > 500ms. | **Fail-Safe Local Buffer**: Producer fails open to a local disk-backed SQLite ring buffer (`/tmp/event-spool.db`). Circuit breaker trips and emits a P1 Datadog alert. A background daemon drains spool files once Kafka connection recovers. | On-call Platform Engineer (SLA: 15-minute response). Runbook: `runbooks/kafka-broker-recovery.md`. |
| **Consumer Lag & Backpressure** | `kafka_consumer_lag_records` > 10,000 for > 3 minutes. | **Automated HPA Scaling**: Kubernetes Horizontal Pod Autoscaler automatically scales consumer pods from 3 to 12 replicas. If lag exceeds 50,000, trigger P2 alert to run `./scripts/scale-consumers.sh --topic pageviews --replicas 20`. | Automated HPA (Trigger in 60s) + On-call Platform Escalation. |
| **Purchase Event Out-of-Order Execution** | Partition skew or sequence mismatch alerts. | **Partition Key Hashing**: Key all purchase events by `user_id` across 12 partitions instead of a single global partition. Guarantees strict per-user sequence ordering while distributing load across 12 consumer threads. | Core Platform Team (Implementation Guard). |

---

## 5. Open Questions & Validation Plan

1. **Database Write Capacity Validation**:
   - *Question*: Can the analytics database sustain 10,000 writes/second under production concurrent read load and active table indexing?
   - *Validation Plan*: Data Engineering team will execute a 24-hour synthetic benchmark using Locust (`scripts/loadtest-db-writes.py`) simulating peak 10k write/sec alongside heavy analytical dashboard queries by Friday, March 21. If p95 write latency exceeds 200ms, micro-batching buffer size will be increased from 100 to 1,000 events.
2. **Kafka Deployment Strategy**:
   - *Question*: Should we manage self-hosted Kafka on Kubernetes or adopt AWS MSK / Confluent Cloud?
   - *Validation Plan*: Platform team will compare monthly infrastructure cost ($350/mo self-hosted vs $1,100/mo MSK) against on-call operational load during Week 1 spike.
