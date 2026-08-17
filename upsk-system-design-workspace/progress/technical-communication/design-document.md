# RFC 004: Centralized Rate Limiting & Tiered Quota Enforcement for Public API

- **Author**: Yash Rao (Backend Platform Team)
- **Status**: Proposed (Review Period: 5 Business Days)
- **Target Audience**: Core API, Platform Infrastructure, and Product Engineering
- **Target Release**: Q3 2026

---

## 1. Problem Statement

Our public API currently has no rate limiting or traffic governance. Over the past 30 days, three critical incidents highlighted the operational and commercial urgency of addressing this gap:

1. **Noisy Neighbor Outages**: A single enterprise customer inadvertently sent 50,000 requests/minute via an unthrottled loop, spiking API p99 latency from 45ms to 1,850ms and causing timeouts for 12 other tenants.
2. **High-Stakes Manual Escalation**: Mitigating the incident required the on-call engineer to manually hardcode an IP/API key block into a configuration file and trigger a full production redeployment at 2:00 AM.
3. **Product Monetization Blocker**: Product is launching a multi-tiered API subscription model (Free: 60 req/min, Pro: 600 req/min, Enterprise: 6,000 req/min), which cannot launch without automated, tiered quota enforcement.

**Impact**: Without automated rate limiting, we risk recurring cascading outages, elevated on-call burnout, and missed subscription revenue.

---

## 2. Proposed Solution: Gateway-Level Sliding Window Counter with Redis

We propose deploying an automated, distributed rate limiter middleware at the API Gateway layer using a **Sliding Window Counter** algorithm backed by a clustered Redis cache.

```
Incoming Request (with Authorization / API Key header)
                     │
                     ▼
          ┌───────────────────────┐
          │  API Gateway Filter   │
          └──────────┬────────────┘
                     │ (Evaluate key: `rl:{apiKey}:{windowMinute}`)
                     ▼
          ┌───────────────────────┐
          │  Clustered Redis      │ ───► Lua Script (Atomic INCR + EXPIRE)
          └──────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
 [Count <= Limit]          [Count > Limit]
        │                         │
        ▼                         ▼
 Forward to Downstream      HTTP 429 Too Many Requests
 Backend API Services       Headers:
                            - Retry-After: <seconds>
                            - X-RateLimit-Limit: 600
                            - X-RateLimit-Remaining: 0
                            - X-RateLimit-Reset: <unix_ts>
```

### Key Technical Details

1. **Algorithm**: Sliding Window Counter (50% weight previous minute window + current minute count). Provides sub-millisecond calculation speed and smooths out traffic spikes at boundary rollovers without the high memory footprint of sliding window logs.
2. **Storage Layer**: Managed Redis cluster using an atomic single-roundtrip Lua script for `INCR` + `EXPIRE` evaluation (<1.5ms overhead per request).
3. **Standard Response Headers**:
   - `HTTP 429 Too Many Requests`
   - `Retry-After: 42`
   - `X-RateLimit-Limit: 600`, `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset: 1776432000`
4. **Degradation / Fail-Open Policy**: If Redis is completely unreachable, the gateway logs a high-priority alert and **fails open** with a fallback local in-memory token bucket to prevent blocking legitimate customer traffic during cache outages.

---

## 3. Alternatives Considered

| Dimension | Option A: Distributed Sliding Window in Redis (Proposed) | Option B: In-Memory Token Bucket per API Node | Option C: Managed Cloudflare / Cloud Gateway Rate Limiting |
| :--- | :--- | :--- | :--- |
| **Description** | Centralized Redis cluster queried by API Gateway instances via Lua script. | In-memory token bucket (e.g., Guava/TokenBucket) local to each Node.js process. | Offload rate limiting entirely to Cloudflare Edge / AWS API Gateway. |
| **Pros** | • Global accuracy across 20+ auto-scaled nodes.<br>• Dynamic quota updates without node redeployments.<br>• Supports tiered limits tied to DB billing status. | • 0 network latency overhead.<br>• No external Redis dependency or infra cost.<br>• Zero failure mode on external service loss. | • Stops abusive traffic at the network edge before hitting our VPC.<br>• Zero backend compute usage for 429 rejections. |
| **Cons** | • Introduces ~1.5ms network roundtrip.<br>• Redis cluster operational overhead and fail-open handling needed. | • Inaccurate under auto-scaling (10 nodes = 10x effective allowed traffic).<br>• Cannot enforce global customer quotas cleanly. | • Vendor lock-in and high variable egress/request inspection costs.<br>• Complex synchronization of dynamic per-customer tier metadata to edge. |
| **Why Not Chosen** | **Selected**: Balances cross-node quota precision, dynamic tier configuration, and sub-2ms latency. | **Rejected**: Auto-scaling across 15+ pods makes local quotas inaccurate by an order of magnitude. | **Rejected**: Syncing per-customer subscription tier metadata in real-time to third-party edge edge rules adds unnecessary operational complexity and vendor costs. |

---

## 4. Risks and Mitigations

| Risk | Severity | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Redis Cluster Outage** | High | Rate limiter queries hang or drop all traffic. | **Fail-Open with Circuit Breaker**: If Redis timeouts exceed 50ms, trip circuit breaker and fallback to a local in-memory fallback limit (100 req/sec) while emitting P1 alerts. |
| **Latency Penalty on Fast Paths** | Medium | Adding 1-2ms to every API request. | **Colocate Redis with Gateway**: Provision Redis cluster in the same AWS VPC subnet and use connection pooling with pipelined Lua script execution. |
| **Cold Cache Thundering Herd** | Low | First request of tier lookup queries SQL DB. | Cache customer subscription tiers in Redis alongside counters with 1-hour TTL and cache-aside invalidation on Stripe webhook events. |
| **Risk of Doing Nothing** | Critical | Repeated cascading outages and delayed product launch. | Unmitigated rogue clients will crash API cluster during business hours; direct lost revenue. |

---

## 5. Open Questions & Dependencies

1. **Security & Identity**: Should unauthenticated requests be rate-limited strictly by `/24` IP subnet, or by single IP (`/32`)? *(Recommendation: IP `/32` with a strict global 30 req/min limit).*
2. **Infrastructure Sizing**: What is the projected Redis memory footprint for 500k active daily API keys? *(Calculated: ~500k keys * 128 bytes = ~64MB RAM, comfortably within a 2GB cache instance).*
3. **Webhook & Event Notification**: How should we notify enterprise customers when they hit 80% and 100% of their monthly/minute quotas? *(Product & Customer Success alignment needed).*

---

## 6. Implementation Timeline & Next Steps

- **Week 1**: Implement and load-test Redis Lua script and sliding window gateway middleware.
- **Week 2**: Integrate tier metadata lookup with billing service and implement fail-open circuit breaker.
- **Week 3**: Shadow mode deployment (log 429s without dropping traffic) to analyze false-positive rates.
- **Week 4**: Enforce rate limits across Free, Pro, and Enterprise tiers with live telemetry dashboards.
