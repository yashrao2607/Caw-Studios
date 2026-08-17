# Bug #6 Investigation: Connection Pool Leak on Error Path

## 1. Problem Statement
The service exhibited gradual latency degradation and eventual connection timeouts under sustained traffic with occasional 4xx/5xx errors. The code appeared clean on standard inspection, but the connection pool became exhausted after ~2,000 error-inducing requests.

## 2. Profiling & Memory Analysis
- **Methodology**: Monitored heap and connection pool allocation during load test executing 500 requests to an error-triggering path.
- **Pre-Fix Allocation Observation**:
  - `Initial RSS`: 64 MB, `HeapUsed`: 32 MB, `Active Pool Connections`: 2
  - `After 500 Error Requests`: `HeapUsed`: 118 MB, `Active Pool Connections`: 50 (Pool Max Cap reached)
  - `Root Cause`: Database connection acquisition occurred inside the `try` block, with release scheduled at the end of the `try` block. When exceptions occurred during query execution, execution jumped directly to `catch`, bypassing `.release()`.

## 3. Implementation Fix
Ensured all connection acquisitions use the `finally` block or automated resource disposal to guarantee release regardless of execution outcome:

```typescript
// Fixed Resource Management Pattern
let connection;
try {
  connection = await pool.acquire();
  return await connection.query(sql, params);
} catch (error) {
  logger.error('Query execution failed', { error: error.message });
  throw error;
} finally {
  if (connection) {
    connection.release(); // Guarantees return to pool on both success and error paths
  }
}
```

## 4. Verification Results
- Executed 2,000 error-inducing requests against the endpoint.
- Active connection count remained flat at 2-5 connections.
- Memory usage stabilized with regular garbage collection cycles and zero pool starvation.
