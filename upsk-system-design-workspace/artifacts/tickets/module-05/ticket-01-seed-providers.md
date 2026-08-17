# TICKET-01: Database Schema Migration & Provider Seeding

## 1. Title
`[DB] Initialize Core Tables (providers, services, bookings) & Seed Test Data`

## 2. Context (Why)
To support Slice 1 demand-side verification, the backend requires a persistent PostgreSQL data model for service providers and bookings along with 3 deterministic seeded provider records.

## 3. Scope (What)
- Create PostgreSQL migration establishing `providers`, `services`, and `bookings` tables with UUID primary keys and foreign key constraints.
- Create an idempotent seed script inserting exactly 3 service providers with 1 active service and fixed hourly rates.

## 4. Interface Contract (Inputs/Outputs/Data Shapes)
### Schema Definition
```sql
CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id),
    service_id UUID NOT NULL REFERENCES services(id),
    user_id UUID, -- NULL for anonymous bookings in Slice 1
    contact_email VARCHAR(255) NOT NULL,
    scheduled_slot TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 5. Acceptance Criteria (Given / When / Then)
- **Scenario 1: Migration Execution**
  - **Given** an empty development PostgreSQL database.
  - **When** running the migration command `npm run db:migrate`.
  - **Then** tables `providers`, `services`, and `bookings` are created without syntax errors.
- **Scenario 2: Seed Idempotency**
  - **Given** migrated database tables.
  - **When** running `npm run db:seed` twice consecutively.
  - **Then** exactly 3 rows exist in `providers` (e.g. "Maria Gomez", "David Chen", "Sarah Jenkins") and no duplicates are inserted.

## 6. Constraints
- Must use PostgreSQL 15+ and TypeORM / Prisma (matching workspace conventions).
- All timestamps must be stored in UTC (`TIMESTAMPTZ`).
- Primary keys must be UUID v4.

## 7. Anti-Scope
- ❌ No dynamic availability time-slot calculation table (slots are static in Slice 1).
- ❌ No user accounts or authentication tables (deferred to Ticket 04).
- ❌ No payment transaction or escrow ledger tables.
