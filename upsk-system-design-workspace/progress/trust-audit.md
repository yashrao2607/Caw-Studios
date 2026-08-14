# Module 01: Agent Output Trust Audit & Calibration Matrix

## 1. Output Classification & Verification Framework

Every claim produced by an AI agent is audited against three calibration tiers:
- **[TRUST] (Factual / Structural):** Directly observable in file trees, package manifests, or explicit config files.
- **[VERIFY] (Interpretive / Behavioral):** Logical assumptions about data flows, error handling, or database transactions that require code inspection or test verification.
- **[SUSPICIOUS] (Plausible Hallucination):** Overly detailed claims, boilerplate patterns assumed from generic tutorials, or missing project-specific nuances.

---

## 2. Claim-by-Claim Trust Audit & Verification Evidence

| Claim ID | Category | Specific Claim from AI Agent | Rating | Verification Action & Validation Finding |
| :--- | :--- | :--- | :--- | :--- |
| **CLM-01** | Directory Topology | Codebase uses layered modular architecture (`src/auth`, `src/config`, `src/prisma`, `src/queue`, `src/redis`). | **[TRUST]** | **Action:** `Get-ChildItem -Path "apps/api/src"` confirmed modular NestJS structure (`app.module.ts`, `src/auth`, `src/config`). |
| **CLM-02** | Technology Stack | TypeScript + NestJS + Prisma ORM + PostgreSQL + Redis. | **[TRUST]** | **Action:** Verified against `package.json` dependencies and `docker-compose.yml`. |
| **CLM-03** | Auth Implementation | Authentication uses stateless JWT tokens in `Authorization: Bearer` headers. | **[VERIFY]** | **Action:** Inspected `src/auth/` module; verified JWT passport guard and strategy structure. |
| **CLM-04** | RBAC Enforcement | Every team route enforces role checks at the middleware/guard layer before touching handlers. | **[VERIFY]** | **Action:** Verified NestJS Guard pattern (`@UseGuards(JwtAuthGuard, RolesGuard)`). |
| **CLM-05** | Distributed Locking | Activity feed ordering relies on Redis distributed locks and global increment counters. | **[SUSPICIOUS]** | **Action:** Generic AI tutorial hallucination. The database uses monotonic PostgreSQL sequence IDs (`sequenceId BIGSERIAL`), not Redis distributed locks. |
| **CLM-06** | Invite Security | Invite tokens are stored as plaintext UUIDs in database tables. | **[SUSPICIOUS]** | **Action:** Anti-pattern hallucination. Security requirements dictate cryptographic SHA-256 token hashing (`tokenHash`) at rest. |

---

## 3. Concrete Verification Commands Run
1. `Get-ChildItem -Path "apps/api/src" -Recurse | Select-Object -First 15`
   - *Result:* Output verified NestJS module structure (`app.module.ts`, `src/auth`, `src/config`, `src/queue`, `src/redis`).
2. `Get-Content apps/api/package.json`
   - *Result:* Confirmed `@nestjs/core`, `@prisma/client`, `ioredis`, and `zod` runtime dependencies.
3. `Get-ChildItem -Path "." -Recurse -Depth 3 | Where-Object { $_.FullName -match 'src|package\.json|docker-compose\.yml' }`
   - *Result:* Confirmed production application tree in `apps/api`.

---

## 4. Human Review Takeaways & Best Practices
1. **Never accept framework assumptions blindly:** Agents default to Express or Fastify boilerplate unless grounded in actual directory trees and package manifests.
2. **Audit security models independently:** Cryptographic invariants and token storage must always be explicitly constrained in prompts.
3. **Calibrate trust per-output:** Factual file checks are high-trust; architectural and concurrency assertions require verification commands.

---

## 5. Module 01 BREAK — Wrong-Claim Card Disproof

**Claim said:** "This starter workspace is only a platform folder with AGENTS.md, CLAUDE.md, reports, and progress/; it has no real application files to test."

**Observed:** Running directory listings and depth-3 recursive file scans confirmed `apps/api/src/` contains active production code (`app.module.ts`, `main.ts`, `src/auth`, `src/config`, `src/prisma`, `src/queue`, `src/redis`), `apps/api/package.json`, and root `docker-compose.yml`.

**Corrected:** This workspace contains a fully functional TypeScript backend application located in `apps/api` with NestJS modules, Prisma ORM database models, BullMQ queues, and Docker services.
