# Module 02: CI/CD Pipelines

## Architecture & Decisions
1. **CI Platform:** GitHub Actions (`.github/workflows/ci.yml`) leveraging native ecosystem actions, encrypted secret storage, and step isolation.
2. **Pipeline Topology:** Sequential execution pattern:
   - `Lint` -> `Test` -> `Docker Build` -> `Size Guardrail (<200MB)` -> `Registry Push`
3. **Artifact Traceability:**
   - Every built image is tagged with the exact immutable commit SHA (`${{ github.sha }}`) to guarantee 1:1 code-to-binary traceability in production.
4. **Pipeline Hardening:**
   - **Timeout:** 15-minute global job timeout (`timeout-minutes: 15`) preventing runaway builds.
   - **Dependency Caching:** `actions/setup-node` with `cache: 'npm'` caching `~/.npm` across runs.
   - **Size Guardrail:** Shell assertion failing the pipeline if the built image exceeds 200MB.
   - **Secret Safety:** Registry authentication uses `${{ secrets.REGISTRY_PASSWORD }}` with automatic log masking and zero hardcoded credentials.
   - **Branch Gating:** Image publishing triggers exclusively on `push` to `main`.

## Injected Break Diagnosis & Fix
- **Issue 1 (Secret Leak):** Removed dangerous debug echo statements; piped credentials securely via standard input (`--password-stdin`) with secret masking.
- **Issue 2 (Cache Miss / Slowdown):** Restored npm cache configuration with package-lock hash keying, dropping build time back to normal.
- **Issue 3 (Unintended Deployment):** Added explicit branch gating conditional (`if: github.ref == 'refs/heads/main' && github.event_name == 'push'`), ensuring feature branches only execute validation without publishing image artifacts.
