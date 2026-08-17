# Failure Mode & Resilience Analysis (Module 05)

---

## 1. System Dependency Inventory & Timeout Audit

| Dependency | Connection Method | Configured Timeout | Retry Policy & Backoff | Stance |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | TCP Pool (`pg` / Prisma) | `5000ms` connection, `3000ms` query | 3 attempts, exponential jitter backoff | **Fail-Closed** (503 Service Unavailable) |
| **Redis** | TCP (`ioredis`) | `1500ms` command timeout | 2 attempts, fast-fail | **Fail-Open** (Bypass to DB fallback) |
| **External Auth / OAuth** | HTTPS REST | `2500ms` strict abort signal | 1 attempt, no blind retry | **Fail-Closed** (401 Unauthorized) |
| **Local File System / Temp** | OS Syscalls | `500ms` I/O operation | None | **Fail-Closed** (Structured Error) |
| **Internal DNS Resolver** | OS Resolver (glibc/musl) | `2000ms` timeout (`options timeout:2`) | OS default (2 retries) | **Fail-Closed** (Host Unreachable) |
| **Node.js V8 Runtime** | In-Process Memory / GC | Max Heap `512MB` | Container restart policy | **Fail-Closed** (SIGTERM / Health fail) |

---

## 2. Comprehensive Failure Mode Matrix

| Dependency | Failure Mode | Probability | User Impact | Current Handling | Desired Production Handling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | Connection Refused / Outage | Medium | Complete write failure; reads blocked if un-cached | Unstructured 500 internal error | Catch connection failure; return clean 503 with `Retry-After: 10`; serve cached reads from Redis if present. |
| **PostgreSQL** | Slow Query / Table Locks | High | Connection pool starvation, hanging HTTP threads | Request hangs until client timeout | Strict `3000ms` statement timeout; abort query and return 504 Gateway Timeout; emit `db_slow_query_total` metric. |
| **Redis** | Cache Cluster Down | Medium | Increased DB read latency, potential DB load surge | Application crash if unhandled Redis error | Cache-aside fallback to DB; log warning; emit `cache_fallback_total`; throttle DB read concurrency. |
| **Redis** | Cache Stale / Invalidation Bug | High | Users see outdated link analytics or metadata | Silent data inconsistency | TTL-based expiration (`300s`); version-stamped cache keys; stale-while-revalidate pattern. |
| **External Auth API** | Service Outage | Low-Med | New logins blocked; existing sessions valid | 500 error envelope | Return 503 "Authentication provider unavailable"; preserve local active JWT validation. |
| **External API** | Elevated Latency (>8s) | High | Thread exhaustion, cascading frontend stalls | Threads blocked waiting for response | `AbortSignal.timeout(2500)` with circuit breaker (trip after 5 consecutive timeouts for 30s cooldown). |
| **File System** | Disk Full (Logs / Temp) | Low-Med | Log drops, DB WAL write failure, disk I/O lock | Silent logging failure, potential container freeze | Docker log rotation (`max-size: 50m`, `max-file: 3`); disk usage Prometheus gauge with alert at 85%. |
| **Node.js Runtime** | V8 Out-Of-Memory (OOM) | Low-Med | Container killed instantly (SIGKILL); in-flight requests dropped | Pod restart by Docker/K8s orchestrator | Memory cgroup limit `512MiB`; trigger restart before OOM; node heap usage alert at 80%. |
| **DNS Resolver** | Hostname Resolution Failure | Low | Cryptic EAI_AGAIN errors across all services | Silent 500 errors | Local DNS caching (`dns.lookup` caching or CoreDNS daemon); alert on DNS failure spikes. |
| **Connection Pool** | Pool Exhaustion (Pool Size 10) | Medium | All incoming DB queries queue indefinitely | HTTP requests time out after 30s | Bounded pool queue with 2000ms acquisition timeout; return 503 on pool exhaustion. |

---

## 3. Simulated Failure Experiments & Gap Analysis

| Simulation Drill | Injected Fault | Expected Behavior | Actual Behavior Observed | Production Gap & Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **Sim 1: DB Outage Simulation** | Simulated database connection refusal | Service returns 503 Service Unavailable | Service hung waiting for connection pool timeout (15s) then threw unhandled Prisma 500 | Added explicit Prisma connection timeout (5000ms) and global `PrismaClientKnownRequestError` exception filter returning clean 503. |
| **Sim 2: Fast-Fail Timeout (1ms)** | Configured `AbortSignal.timeout(1)` on outbound dependency call | Request fails fast without thread blocking | Threw unhandled `TimeoutError` returning unstructured 500 | Wrapped outbound calls with resilient `TimeoutExceptionFilter` returning 504 Gateway Timeout and logging timeout telemetry. |

---

## 4. Resilience Architecture & Implementation Strategy
1. **Timeouts on Every Network Boundary**: Zero unbounded HTTP or DB calls.
2. **Circuit Breakers for External Integrations**: Open circuit after 5 failures in 10s window; fast-fail immediately for 30s cooldown.
3. **Graceful Cache Degradation**: Redis disconnection events switch cache client into bypass mode without crashing HTTP request lifecycle.
