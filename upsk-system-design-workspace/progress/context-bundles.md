# Module 03: Per-Task Context Bundles & Justification Matrix

## 1. Bundle 1: Task TSK-01 (Team & Member Prisma Schema)

- **Task Summary:** Define `Team`, `TeamMember`, and `Role` enum in Prisma schema with relations and constraints.
- **Files to Read (with 'If Omitted' Rationale):**
  1. `apps/api/prisma/schema.prisma`
     - *Reason:* Shows existing generator configs, datasource provider (PostgreSQL), and User model definition.
     - *If Omitted:* Agent would generate incompatible relation syntax, wrong casing, or duplicate the datasource block.
  2. `apps/api/package.json`
     - *Reason:* Confirms Prisma version (5.x) and script triggers.
     - *If Omitted:* Agent might attempt Prisma 4 or TypeORM decorators.
- **Files to Modify:**
  - `apps/api/prisma/schema.prisma`
- **Expected Output:**
  - Updated `schema.prisma` containing `model Team`, `model TeamMember`, `enum Role`, and updated `User` relations (`ownedTeams`, `memberships`).

---

## 2. Bundle 2: Task TSK-02 (Teams Service & CRUD Controller)

- **Task Summary:** Create `TeamsModule`, `TeamsController`, `TeamsService`, and DTOs with transactional team creation.
- **Files to Read (with 'If Omitted' Rationale):**
  1. `apps/api/src/links/links.controller.ts` & `links.service.ts`
     - *Reason:* Demonstrates canonical controller structure, `@UseGuards(JwtAuthGuard)`, DTO validation, and service DI.
     - *If Omitted:* Agent would invent custom controller decorators or omit `class-validator` pipes.
  2. `apps/api/src/prisma/prisma.service.ts`
     - *Reason:* Shows exact PrismaService injection token and lifecycle hooks.
     - *If Omitted:* Agent might attempt to instantiate `new PrismaClient()` directly inside the service.
  3. `apps/api/src/app.module.ts`
     - *Reason:* Shows root module imports array where `TeamsModule` must be registered.
     - *If Omitted:* TeamsModule would not be wired into the application bootstrap.
- **Files to Modify:**
  - `apps/api/src/app.module.ts`
- **Expected Output:**
  - `apps/api/src/teams/teams.module.ts`
  - `apps/api/src/teams/teams.controller.ts`
  - `apps/api/src/teams/teams.service.ts`
  - `apps/api/src/teams/dto/create-team.dto.ts`

---

## 3. Bundle 3: Task TSK-03 (Team RBAC Guard Middleware)

- **Task Summary:** Create `@Roles()` decorator and `TeamRoleGuard` checking membership and permissions via Reflector.
- **Files to Read (with 'If Omitted' Rationale):**
  1. `apps/api/src/auth/guards/jwt-auth.guard.ts`
     - *Reason:* Shows standard NestJS CanActivate implementation and execution context handling.
     - *If Omitted:* Agent would implement Express middleware instead of a NestJS ExecutionContext Guard.
  2. `apps/api/src/teams/teams.service.ts`
     - *Reason:* Shows how team membership records are structured in Prisma queries.
     - *If Omitted:* Agent would query the wrong table or assume non-existent helper methods.
- **Files to Modify:**
  - `apps/api/src/teams/teams.controller.ts` (attach `@UseGuards(TeamRoleGuard)`)
- **Expected Output:**
  - `apps/api/src/teams/guards/team-role.guard.ts`
  - `apps/api/src/teams/decorators/roles.decorator.ts`
  - `apps/api/src/teams/guards/team-role.guard.spec.ts`
