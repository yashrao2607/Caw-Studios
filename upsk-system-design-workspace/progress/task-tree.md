# Module 02: Team Collaboration Task Tree & Execution Specification

## 1. Atomic Task Tree (10 Medium-Grained Tasks)

| Task ID | Task Name | Input Context / Reference Files | Expected Output / Deliverables | Acceptance Criteria (External Verification) | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-01** | Team & Member Prisma Schema | `apps/api/prisma/schema.prisma` | Updated Prisma schema with `Team`, `TeamMember`, `Role` enum, and migration script. | `npx prisma migrate dev` succeeds; PostgreSQL tables created with foreign keys and unique constraints. | None |
| **TSK-02** | Teams Service & CRUD Controller | `src/auth/`, `src/prisma/prisma.service.ts` | `src/teams/teams.module.ts`, `teams.controller.ts`, `teams.service.ts`, DTOs. | `POST /api/v1/teams` returns 201 with team payload; creator auto-assigned as `OWNER`. | TSK-01 |
| **TSK-03** | Team RBAC Guard Middleware | `src/common/guards/`, `src/auth/` | `src/teams/guards/team-role.guard.ts`, `@Roles()` decorator. | Request without required role returns `403 Forbidden` with `{ "statusCode": 403, "message": "Forbidden resource" }`. | TSK-02 |
| **TSK-04** | Team Invite Token Data Model | `apps/api/prisma/schema.prisma` | `TeamInvite` schema with `tokenHash`, `expiresAt`, status enum. | Migration creates `team_invites` table with unique constraint on `(team_id, email)`. | TSK-01 |
| **TSK-05** | Send Invite Service & Endpoint | `src/teams/`, `src/queue/` | `POST /api/v1/teams/:id/invites` handler, BullMQ email job dispatch. | `POST /api/v1/teams/:id/invites` returns 201; enqueues email job; creates hashed token record. | TSK-03, TSK-04 |
| **TSK-06** | Accept & Revoke Invite Handlers | `src/teams/`, `src/prisma/` | `POST /api/v1/invites/:token/accept`, `DELETE /api/v1/teams/:id/invites/:inviteId`. | Accepting valid token adds user to team and marks invite accepted; revoked token returns 400. | TSK-05 |
| **TSK-07** | Discussion Comments & Mentions | `src/teams/`, `src/prisma/` | `Comment` model, `POST /api/v1/teams/:id/comments`, mention parser regex. | `POST /api/v1/teams/:id/comments` saves comment and emits notification jobs for extracted `@usernames`. | TSK-03 |
| **TSK-08** | Real-Time Ordered Activity Stream | `src/redis/`, `src/prisma/` | `ActivityEvent` model, PostgreSQL sequence, SSE/WebSocket gateway. | Sequential activity events stream in strict `sequenceId` order across reconnects. | TSK-03 |
| **TSK-09** | Immutable Audit Log Interceptor | `src/common/interceptors/` | `AuditLogInterceptor`, `AuditLog` table. | Sensitive mutations (`CREATE_INVITE`, `UPDATE_ROLE`, `DELETE_TEAM`) write immutable audit row with actor IP. | TSK-03 |
| **TSK-10** | End-to-End Collaboration Test Suite | `apps/api/test/` | `apps/api/test/teams-collaboration.e2e-spec.ts`. | `npm run test:e2e` executes all 10 workflow steps with 100% assertions passing. | TSK-06, TSK-07, TSK-08, TSK-09 |

---

## 2. Explicit Interface Contracts Across Dependency Edges

### Contract C-01: TSK-01 (Prisma Schema) -> TSK-02 (Teams Service)
- **Producer (TSK-01):**
  - Table `teams`: `id` (UUID PK), `name` (VarChar 100), `slug` (VarChar 100 UNIQUE), `owner_id` (UUID FK -> users.id), `created_at`, `updated_at`.
  - Table `team_members`: `id` (UUID PK), `team_id` (UUID FK -> teams.id), `user_id` (UUID FK -> users.id), `role` (enum: `OWNER`, `ADMIN`, `MEMBER`), `joined_at`.
  - Constraint: `UNIQUE(team_id, user_id)`.
- **Consumer (TSK-02):**
  - Expects Prisma Client models `prisma.team` and `prisma.teamMember`.
  - Uses transactional `prisma.$transaction([createTeam, createMember])` assigning creator as `OWNER`.
- **Shared Agreement:** Schema migration must be committed and Prisma Client generated before TSK-02 compiles.

---

### Contract C-02: TSK-02 (Teams CRUD) -> TSK-03 (RBAC Guard)
- **Producer (TSK-02):**
  - Controller routes expose `:teamId` or `:id` route parameter.
  - Authenticated request context populates `request.user = { id: string, email: string }`.
- **Consumer (TSK-03):**
  - `@Roles(Role.OWNER, Role.ADMIN)` metadata attached to routes.
  - `TeamRoleGuard` queries `prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } })`.
- **Shared Agreement:** Returns 403 Forbidden with standard payload `{ statusCode: 403, message: "Insufficient permissions" }`.

---

### Contract C-03: TSK-04/TSK-05 -> TSK-06 (Invite Token Flow)
- **Producer (TSK-04/05):**
  - `TeamInvite`: `id`, `teamId`, `email`, `role`, `tokenHash` (SHA-256 string), `expiresAt` (Timestamp), `status` (`PENDING`, `ACCEPTED`, `REVOKED`).
  - `POST /api/v1/teams/:id/invites` returns cleartext token once to inviter/email queue; saves SHA-256 hash in database.
- **Consumer (TSK-06):**
  - `POST /api/v1/invites/:token/accept` hashes input token with SHA-256, matches `tokenHash`, verifies `status == 'PENDING'` and `expiresAt > NOW()`.
- **Shared Agreement:** Token verification is single-use and executed within an atomic database transaction.

---

## 3. Complete Prompt Specifications for First 3 Tasks

### Prompt 1: Task TSK-01 (Team & Member Prisma Schema)
```markdown
You are working on the TaskFlow backend in apps/api.
Reference: apps/api/prisma/schema.prisma and the existing User model.

Deliverable:
Update apps/api/prisma/schema.prisma to add Team and TeamMember models with role-based access:
1. Define Role enum with values: OWNER, ADMIN, MEMBER.
2. Define Team model:
   - id: UUID (default uuid(), @id)
   - name: String (VarChar 100)
   - slug: String (VarChar 100, unique)
   - ownerId: String (UUID, relation to User)
   - createdAt: DateTime (default now())
   - updatedAt: DateTime (updatedAt)
   - Relations: owner (User), members (TeamMember[])
3. Define TeamMember model:
   - id: UUID (default uuid(), @id)
   - teamId: String (UUID, relation to Team, onDelete: Cascade)
   - userId: String (UUID, relation to User, onDelete: Cascade)
   - role: Role (default MEMBER)
   - joinedAt: DateTime (default now())
   - Constraints: @@unique([teamId, userId])

Conventions:
- Match PascalCase for model names and camelCase for field names as in existing schema.
- Do not install new packages. Generate only valid Prisma schema syntax.
```

### Prompt 2: Task TSK-02 (Teams Service & CRUD Controller)
```markdown
You are working on the TaskFlow backend in apps/api/src.
Reference: apps/api/src/auth/guards/jwt-auth.guard.ts, apps/api/src/prisma/prisma.service.ts, and apps/api/src/app.module.ts.
Contract Reference: Contract C-01 (Team & TeamMember models exist).

Deliverable:
Create a new NestJS module apps/api/src/teams/ containing:
1. CreateTeamDto with class-validator: name (string, min 2, max 100).
2. TeamsService:
   - createTeam(userId: string, dto: CreateTeamDto): inside a Prisma transaction, creates the Team and immediately creates a TeamMember record for userId with role OWNER.
   - getUserTeams(userId: string): returns all teams where userId is a member.
3. TeamsController:
   - @UseGuards(JwtAuthGuard) on controller.
   - @Post() endpoint creating team from authenticated req.user.id.
   - @Get() endpoint listing user's teams.
4. TeamsModule: register TeamsController, TeamsService, PrismaModule and export TeamsService.
5. Register TeamsModule in apps/api/src/app.module.ts.

Conventions:
- Use standard NestJS dependency injection.
- Ensure 400 Bad Request on invalid DTO inputs.
- Do not add extraneous dependencies.
```

### Prompt 3: Task TSK-03 (Team RBAC Guard Middleware)
```markdown
You are working on the TaskFlow backend in apps/api/src.
Reference: apps/api/src/teams/teams.service.ts and apps/api/src/prisma/prisma.service.ts.
Contract Reference: Contract C-02 (TeamRoleGuard).

Deliverable:
Implement a reusable NestJS Role Guard for team resources:
1. Create decorator @Roles(...roles: Role[]) in apps/api/src/teams/decorators/roles.decorator.ts using Reflector.
2. Create TeamRoleGuard implementing CanActivate in apps/api/src/teams/guards/team-role.guard.ts:
   - Extract teamId from request params (:id or :teamId).
   - Extract userId from request.user (set by JwtAuthGuard).
   - Query TeamMember for (teamId, userId).
   - If membership does not exist, throw ForbiddenException('Not a member of this team').
   - Compare member.role against required roles from Reflector. If insufficient, throw ForbiddenException('Insufficient permissions').
   - Return true if authorized.

Conventions:
- Use Reflector from @nestjs/core.
- Handle missing route params gracefully by throwing BadRequestException('Team ID required').
- Write unit tests for TeamRoleGuard covering OWNER, ADMIN, MEMBER, and non-member cases in team-role.guard.spec.ts.
```

---

## 4. Critical Path & Risk Analysis

### Critical Path (5 Levels):
`TSK-01 (Schema)` -> `TSK-02 (Teams CRUD)` -> `TSK-03 (RBAC Guard)` -> `TSK-05 (Invite Endpoints)` -> `TSK-06 (Accept Flow)` -> `TSK-10 (E2E Tests)`

### Riskiest Task:
- **Task:** `TSK-06: Accept & Revoke Invite Handlers` (and `TSK-05: Single-Use Hashing`)
- **Risk Type:** Security & Concurrency Risk.
- **Failure Mode:** Race conditions during concurrent acceptance of the same invite token, replay attacks, or role escalation if the inviter was demoted prior to invite redemption. Handled via Contract C-03 (SHA-256 token hashing and atomic transactional state updates).
