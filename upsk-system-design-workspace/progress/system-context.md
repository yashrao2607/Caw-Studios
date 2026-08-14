# Module 03: System-Level Context Document & Engineering Constraints (Corrected)

## 1. Architectural Architecture & Project Topology

- **Runtime & Framework:** Node.js v20+ / NestJS 10.x (TypeScript 5.x)
- **Database & ORM:** PostgreSQL 16 managed via Prisma ORM 5.x (`apps/api/prisma/schema.prisma`)
- **Caching & Asynchronous Messaging:** Redis 7.x managed via `ioredis` and BullMQ (`apps/api/src/queue/`)
- **Module Structure:** Modular NestJS architecture organized in `apps/api/src/<domain>/` with dedicated `<domain>.module.ts`, `<domain>.controller.ts`, and `<domain>.service.ts`.
- **Global Filters:** Centralized `HttpExceptionFilter` bound in `main.ts` intercepts all NestJS exceptions and serializes them into a unified response shape.

---

## 2. Coding & Naming Conventions

- **Code Symbols:**
  - Classes, Interfaces, Enums, DTOs: `PascalCase` (e.g. `TeamsController`, `CreateTeamDto`, `TeamRoleGuard`).
  - Functions, Methods, Variables, Properties: `camelCase` (e.g. `createTeam`, `getUserTeams`, `tokenHash`).
  - Database Table Names: `snake_case` plural (e.g. `teams`, `team_members`, `team_invites`).
- **File Naming:**
  - Controllers: `*.controller.ts`
  - Services: `*.service.ts`
  - Modules: `*.module.ts`
  - DTOs: `*.dto.ts`
  - Filters: `*.filter.ts`
  - Guards: `*.guard.ts`
  - Unit/E2E Tests: `*.spec.ts` / `*.e2e-spec.ts`

---

## 3. Standardized Error Handling & Exception Filter Invariant

All HTTP error responses are processed by `HttpExceptionFilter` (`apps/api/src/common/filters/http-exception.filter.ts`) and MUST adhere to this exact JSON schema:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Team name must be between 2 and 100 characters",
    "details": []
  }
}
```

### Standard Status Code Mapping:
- `400 Bad Request` (`BadRequestException`) -> `code: "VALIDATION_ERROR"`
- `401 Unauthorized` (`UnauthorizedException`) -> `code: "UNAUTHORIZED"`
- `403 Forbidden` (`ForbiddenException`) -> `code: "FORBIDDEN"`
- `404 Not Found` (`NotFoundException`) -> `code: "NOT_FOUND"`
- `409 Conflict` (`ConflictException`) -> `code: "CONFLICT"`
- `500 Internal Error` (`InternalServerErrorException`) -> `code: "INTERNAL_ERROR"`

**STRICT NEGATIVE CONSTRAINT:**
- Do NOT return flat error objects like `{ "status": "error", "message": "..." }`.
- Do NOT return plain text error strings.
- Throw standard NestJS exceptions (`throw new BadRequestException(...)`) so the global filter handles serialization.

---

## 4. System-Level Guardrails & Negative Constraints

1. **No Extraneous Dependencies:** Do not add external npm packages; utilize existing `@nestjs/*`, `@prisma/client`, `class-validator`, `class-transformer`, and `ioredis`.
2. **Auth Reuse:** Reuse existing `JwtAuthGuard` from `src/auth/guards/jwt-auth.guard.ts`. Never implement custom unvetted JWT parsing.
3. **Transaction Safety:** Multi-entity writes (e.g. creating a Team + creating owner TeamMember) MUST use `prisma.$transaction`.
4. **Hashed Token Security:** Invitation and sensitive tokens MUST be stored as SHA-256 hashes (`tokenHash`), never cleartext.
