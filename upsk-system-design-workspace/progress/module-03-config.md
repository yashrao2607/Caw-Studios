# Module 03: Environment Management & Configuration

## Architecture & Decisions
1. **Secret Strategy:** Platform Environment Variables (`platform_env`) compliant with Twelve-Factor App principles.
2. **Configuration Model:** Single centralized configuration module (`apps/api/src/config/app-config.ts`) with strict fail-fast validation (`validateConfig`).
3. **Fail-Fast Boot Guarantees:**
   - Missing required variables (`DATABASE_URL`, `JWT_SECRET`, `APP_ENV`) halt process initialization before routing or database connection attempts.
   - Enums and types are validated (e.g. `APP_ENV` must be `development | staging | production`, `PORT` must be a valid integer).
4. **Environment-Specific Behaviors:**
   - `development`: Verbose debug logging, permissive CORS origin `*`, detailed error stack traces.
   - `staging`: Info logging, staging domain CORS, detailed diagnostic errors.
   - `production`: Info/Warn structured JSON logging, strict origin CORS, sanitized generic error responses.
5. **Contract Documentation:**
   - Created `.env.example` as the canonical source of truth for required vs optional environment flags.
