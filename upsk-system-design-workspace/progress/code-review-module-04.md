# Module 04: AI-Generated Code Review & Vulnerability Audit

## 1. Structured Review by File Across 5 Failure Categories

### File 1: `apps/api/prisma/schema.prisma` (Team & TeamMember models)

| Category | Finding | Severity | Evidence |
|---|---|---|---|
| **Security** | Missing cascade delete safety guards and index on `owner_id` | Medium | Line 19: `fields: [ownerId], references: [id]` lacks index for large user query scale. |
| **Edge Cases** | Slug collision under concurrent team creation with identical names | High | Line 17: Slug generation is deterministic; concurrent creations could race on unique constraint without retry. |
| **Error Handling** | Raw database error propagation on slug uniqueness violation | Medium | Prisma P2002 error will bubble up if not caught in service layer. |
| **Naming** | Clean, consistent PascalCase and camelCase matching existing schema | Low | Model names `Team`, `TeamMember`, `Role` adhere to conventions. |
| **Tests** | Schema migration validity and foreign key constraints untested | High | Needs unit/integration tests asserting cascade deletions and unique index integrity. |

---

### File 2: `apps/api/src/teams/teams.service.ts` (Teams Service)

| Category | Finding | Severity | Evidence |
|---|---|---|---|
| **Security** | Missing input sanitization on team name allowing XSS/injection payloads | High | Line 61: Regex replaces non-alphanumerics for slug, but `dto.name` raw text is inserted without HTML sanitization. |
| **Edge Cases** | Empty/whitespace string names generate empty slugs `""` | High | Line 61: String `---` produces empty slug `""` which passes validation. |
| **Error Handling** | Transaction failure in multi-step team creation throws generic error | Medium | Line 67: `$transaction` failure does not provide tailored recovery context. |
| **Naming** | Clear, domain-focused naming (`createTeam`, `getUserTeams`) | Low | Follows NestJS service naming standards. |
| **Tests** | Only happy path tested; slug collisions and transaction aborts untested | High | Missing negative test suites for non-unique slugs and invalid user UUIDs. |

---

### File 3: `apps/api/src/teams/guards/team-role.guard.ts` (TeamRoleGuard)

| Category | Finding | Severity | Evidence |
|---|---|---|---|
| **Security** | IDOR vector if route parameter naming mismatch occurs (`:id` vs `:teamId`) | Critical | Line 137: `request.params.id || request.params.teamId` - if nested sub-resources have both, wrong param could be validated. |
| **Edge Cases** | Non-UUID string in `teamId` or `userId` throws unhandled Prisma validation crash | High | Line 148: If `teamId` is invalid format, DB query crashes instead of returning 400 Bad Request. |
| **Error Handling** | Missing error distinction between unauthenticated (401) and forbidden (403) | Medium | Line 144: Returns 403 Forbidden for missing `userId` instead of standard 401 Unauthorized. |
| **Naming** | `TeamRoleGuard` is descriptive and reflects NestJS guard conventions | Low | Follows standard decorator pattern. |
| **Tests** | Guard untested for hierarchy inheritance (e.g. OWNER having implicit ADMIN rights) | High | Test suite only tests exact role match, not role hierarchy. |

---

## 2. Prioritized Fix List

1. **[CRITICAL] Parameter Resolution & Strict UUID Validation in `TeamRoleGuard`**
   - **File**: `apps/api/src/teams/guards/team-role.guard.ts`
   - **Fix**: Validate UUID format using regex before querying DB; disambiguate route param explicitly. Return 401 for unauthenticated requests.
2. **[HIGH] Slug Generation & Empty Name Edge Case in `TeamsService`**
   - **File**: `apps/api/src/teams/teams.service.ts`
   - **Fix**: Reject whitespace-only names with `BadRequestException`, add random hex suffix fallback on slug collisions.
3. **[HIGH] Role Hierarchy Enforcement (OWNER > ADMIN > MEMBER)**
   - **File**: `apps/api/src/teams/guards/team-role.guard.ts`
   - **Fix**: Implement role hierarchy check so `OWNER` automatically satisfies `ADMIN` and `MEMBER` requirements.

---

## 3. Targeted Follow-Up Prompts & Implementation

### Prompt 1: Fix TeamRoleGuard UUID validation, HTTP status codes, and Role Hierarchy
```typescript
// Refactored TeamRoleGuard
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.OWNER]: 3,
  [Role.ADMIN]: 2,
  [Role.MEMBER]: 1,
};
```
