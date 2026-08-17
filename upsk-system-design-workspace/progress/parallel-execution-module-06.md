# Module 06: Multi-Agent Parallel Execution & Coordination

## 1. Locked Interface Contracts

### Agent 1: Comment Threads
- **Creates**: `apps/api/src/comments/` (`comments.service.ts`, `comments.controller.ts`, `comments.module.ts`, `dto/create-comment.dto.ts`)
- **Reads**: `User`, `Task`, `TeamRoleGuard`
- **Data Shape**:
  ```typescript
  export interface Comment {
    id: string; // UUID v4
    taskId: string;
    authorId: string;
    body: string;
    parentId?: string | null;
    createdAt: string; // ISO 8601 UTC
    updatedAt: string;
  }
  ```
- **Events Emitted**: `comment.created`, `comment.updated`, `comment.deleted`

---

### Agent 2: @Mention Parsing & Notification Service
- **Creates**: `apps/api/src/mentions/` (`mention-parser.util.ts`, `mentions.service.ts`, `mentions.module.ts`)
- **Reads**: `User`
- **Data Shape**:
  ```typescript
  export interface ParsedMention {
    raw: string; // "@jane.doe"
    username: string; // "jane.doe"
    userId: string | null;
    position: { start: number; end: number };
  }
  ```
- **Integration Point**: `mentionsService.processTextMentions(text, context)` invoked on comment and task creation.

---

### Agent 3: Audit Log & Security Middleware
- **Creates**: `apps/api/src/audit/` (`audit.interceptor.ts`, `audit.service.ts`, `audit.module.ts`)
- **Reads**: `User`, `AuthGuard`
- **Data Shape**:
  ```typescript
  export interface AuditLogEntry {
    id: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    resourceType: 'TASK' | 'TEAM' | 'MEMBER' | 'COMMENT';
    resourceId: string;
    actorId: string;
    metadata: Record<string, any>;
    timestamp: string;
  }
  ```
- **Integration Point**: Intercepts HTTP mutations + subscribes to EventEmitter2 domain events.

---

## 2. Parallel Coordination & Sequential Integration Plan

```
[Agent 1: Comments]    [Agent 2: Mentions]    [Agent 3: Audit]
         │                     │                    │
         ▼                     ▼                    ▼
   (Comments PR)         (Mentions PR)         (Audit PR)
         │                     │                    │
         └──────────────┬──────┴────────────────────┘
                        │
                        ▼ (Sequential Integration Gate)
               [Integration Test Suite]
                        │
                        ▼
            [Unified Clean Build & Pass]
```

### Conflict Resolution Matrix
1. **Schema Collision**: Model definitions isolated into modular Prisma relation extensions.
2. **Event Naming Consistency**: Standardized on dot-notation lowercase verbs (`<entity>.<action>`).
3. **Glue Layer**: Integrated `CommentsService` -> `MentionsService` -> `AuditService` pipeline within transactional boundaries.
