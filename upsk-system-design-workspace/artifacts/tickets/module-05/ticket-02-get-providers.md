# TICKET-02: GET /api/v1/providers — List Seeded Providers (AI-Ready)

## 1. Title
`[API] GET /api/v1/providers — Provider Catalog Listing Endpoint`

## 2. Context (Why)
Enables the frontend landing page to display available service professionals to prospective clients, proving discovery functionality in Slice 1.

## 3. Scope (What)
- Implement NestJS Controller endpoint `GET /api/v1/providers`.
- Implement `ProvidersService.findAll()` querying PostgreSQL `providers` with associated `services`.
- Return sanitized JSON response formatted for client card rendering.

## 4. Interface Contract (Inputs/Outputs/Data Shapes)
### HTTP Request
- **Method**: `GET`
- **Path**: `/api/v1/providers`
- **Query Parameters**: None (Pagination and category filtering are explicitly out of scope).
- **Headers**: `Accept: application/json`

### HTTP Responses
#### 200 OK
```json
{
  "data": [
    {
      "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "name": "Maria Gomez",
      "category": "Home Cleaning",
      "bio": "Certified eco-friendly cleaning professional with 8 years experience.",
      "avatar_url": "https://assets.skillswap.dev/avatars/maria.jpg",
      "rating": 4.95,
      "services": [
        {
          "id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
          "title": "Deep Clean Service",
          "price_cents": 12000,
          "duration_minutes": 120
        }
      ]
    }
  ]
}
```
#### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch providers from database"
  }
}
```

## 5. Acceptance Criteria (Given / When / Then)
- **Scenario 1: Successful Catalog Fetch**
  - **Given** the database has 3 seeded provider records.
  - **When** a client sends `GET /api/v1/providers`.
  - **Then** the server responds with HTTP 200 OK and an array containing exactly 3 provider objects, each including `id`, `name`, `category`, `rating`, and nested `services`.
- **Scenario 2: Empty Database Handling**
  - **Given** the database `providers` table is empty.
  - **When** a client sends `GET /api/v1/providers`.
  - **Then** the server responds with HTTP 200 OK and `{ "data": [] }`.

## 6. Constraints
- Framework: NestJS with `@Controller('api/v1/providers')`.
- Serialization: Use `class-transformer` or plain DTO serialization.
- SQL Query: Single eager join on `services` table to prevent N+1 query overhead.

## 7. Anti-Scope
- ❌ No text search queries (`?q=...`) or category filtering (`?category=...`).
- ❌ No cursor or offset pagination (returns all seeded providers).
- ❌ No authentication guards (endpoint is publicly accessible).
