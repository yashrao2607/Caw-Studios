# Module 01: TaskFlow Architecture Summary & Codebase Exploration (Corrected)

## 1. Project Topology & Directory Structure (Verified NestJS Architecture)

```
upsk-system-design-workspace/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── auth/            # NestJS Auth module (JWT strategies, guards, DTOs)
│       │   ├── common/          # Shared filters, pipes, interceptors, decorators
│       │   ├── config/          # Runtime environment schema validation (Zod)
│       │   ├── links/           # Link shortening & analytics controller/service
│       │   ├── prisma/          # PrismaService singleton database provider
│       │   ├── queue/           # BullMQ Redis asynchronous job processor
│       │   ├── redirect/        # High-performance redirect router & cache layer
│       │   ├── redis/           # Redis connection manager & caching client
│       │   ├── app.module.ts    # Root NestJS application module
│       │   ├── health.controller.ts # Liveness & readiness probes
│       │   └── main.ts          # Bootstrap entrypoint & Swagger setup
│       ├── prisma/              # schema.prisma & PostgreSQL migrations
│       └── package.json         # NestJS 10, Prisma 5, IORedis, BullMQ dependencies
├── docker-compose.yml           # PostgreSQL 16 + Redis 7 dev infrastructure
└── .env.example                 # Standardized Twelve-Factor environment configuration
```

---

## 2. Core Data Models & Relationships

| Entity | Primary Key | Foreign Keys / References | Key Fields | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **User** | `id` (UUID) | — | `email`, `passwordHash`, `name`, `createdAt` | Base account identity. |
| **Team** | `id` (UUID) | `ownerId` -> User | `name`, `slug`, `createdAt`, `updatedAt` | Multi-tenant organization grouping. |
| **TeamMember** | `id` (UUID) | `teamId` -> Team, `userId` -> User | `role` (`OWNER`, `ADMIN`, `MEMBER`), `joinedAt` | Membership join table with RBAC roles. |
| **TeamInvite** | `id` (UUID) | `teamId` -> Team, `invitedBy` -> User | `email`, `tokenHash`, `role`, `expiresAt`, `status` | Single-use cryptographically hashed token. |
| **Comment** | `id` (UUID) | `teamId` -> Team, `authorId` -> User | `content`, `mentions` (JSONB), `createdAt` | Discussion thread with @mentions. |
| **ActivityEvent**| `id` (UUID) | `teamId` -> Team, `actorId` -> User | `actionType`, `payload` (JSONB), `sequenceId`, `createdAt` | Monotonic PostgreSQL sequence event stream. |
| **AuditLog** | `id` (UUID) | `teamId` -> Team, `actorId` -> User | `action`, `resourceId`, `ipAddress`, `userAgent`, `timestamp` | Immutable compliance ledger. |

---

## 3. Verified Extension Points

1. **New NestJS Feature Module:** Create `src/<feature>/<feature>.module.ts`, `<feature>.controller.ts`, and `<feature>.service.ts`; register in `src/app.module.ts`.
2. **Database Models:** Define Prisma schema models in `apps/api/prisma/schema.prisma` and execute migrations.
3. **Guards & RBAC:** Implement NestJS `CanActivate` guards with metadata reflection (`@Roles('OWNER', 'ADMIN')`).
4. **Async Background Jobs:** Register BullMQ `@Processor('<queue-name>')` job consumers in `src/queue/`.
