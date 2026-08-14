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

## Injected Break Diagnosis & Fix
- **Issue 1 (Precedence Inversion):** Ensured real environment variables (`process.env`) always override any fallback `.env` defaults when running in containerized/production environments.
- **Issue 2 (Unvalidated Config Field):** Added strict schema validation for all environment keys, preventing deferred runtime errors.
- **Issue 3 (Dangerous Localhost Defaults):** Removed silent localhost fallbacks on database and secret fields, guaranteeing loud startup failures if configuration is absent.
- **Verification Evidence:**
  - Removed `DATABASE_URL` -> app immediately failed with `Missing required environment variable: DATABASE_URL`.
  - Set invalid `APP_ENV=banana` -> app failed with `Invalid APP_ENV "banana". Allowed values: development, staging, production`.
  - Tested container with `-e APP_ENV=production` -> runtime correctly logged `environment: "production"` with zero secret leakage.
