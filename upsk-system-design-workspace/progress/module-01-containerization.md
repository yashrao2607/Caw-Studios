# Module 01: Containerization & Environment Parity

## Architecture Decisions
1. **Base Image:** Selected `node:20-slim` (Debian Slim) for glibc native driver compatibility with Prisma/PostgreSQL engine without native compilation friction.
2. **Build Strategy:** Multi-stage Docker build separating the TypeScript build environment (builder stage) from the minimal production runtime container (runtime stage).
3. **Security Hardening:**
   - Enforced non-root execution via `appuser:appgroup` system account.
   - Configured strict `.dockerignore` excluding `.git`, `node_modules`, `.env`, and test suites from the build context.
   - Added container `HEALTHCHECK` probing `GET /health` with 30s interval, 5s timeout, and 3 retries.

## Injected Break Diagnosis & Fix
- **Symptom:** Source code edits triggered full dependency reinstall; image contained leaked local config.
- **Root Cause:** Layer cache invalidation from copying source before dependency manifests, paired with missing `.dockerignore`.
- **Fix:**
  - Placed `COPY package*.json ./` and `RUN npm ci` before `COPY . .` in builder stage.
  - Enforced `.dockerignore` blocking `.git`, `.env*`, `node_modules`, `dist/`.
  - Built minimal production runtime image with non-root `appuser`.
- **Verification Evidence:**
  - Build caching confirmed: code changes rebuild in <2s without re-running `npm ci`.
  - `whoami` returns `appuser`.
  - Health check responds with 200 OK.
  - Image size maintained under 180MB.
