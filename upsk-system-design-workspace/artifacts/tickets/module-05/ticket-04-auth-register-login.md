# TICKET-04: POST /api/v1/auth/register & login — JWT Authentication (AI-Ready)

## 1. Title
`[AUTH] Implement User Registration, Password Hashing, and JWT Login Endpoints`

## 2. Context (Why)
Enables Slice 2 authenticated capabilities, allowing customers to establish accounts, link future bookings to their user profile, and access personal booking histories.

## 3. Scope (What)
- Create `users` table migration (`id`, `email`, `password_hash`, `created_at`).
- Implement `POST /api/v1/auth/register` (argon2/bcrypt password hashing).
- Implement `POST /api/v1/auth/login` returning signed JWT with `{ sub: user.id, email: user.email }` (15m expiry).
- Create NestJS `JwtAuthGuard` enforcing Bearer token validation.

## 4. Interface Contract (Inputs/Outputs/Data Shapes)
### HTTP Requests
#### 1. Register (`POST /api/v1/auth/register`)
- **Body**: `{ "email": "user@example.com", "password": "SecurePassword123!" }`
- **201 Created**: `{ "id": "uuid", "email": "user@example.com", "created_at": "timestamp" }`
- **409 Conflict**: `{ "statusCode": 409, "message": "Email already registered" }`

#### 2. Login (`POST /api/v1/auth/login`)
- **Body**: `{ "email": "user@example.com", "password": "SecurePassword123!" }`
- **200 OK**:
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 900
}
```
- **401 Unauthorized**: `{ "statusCode": 401, "message": "Invalid email or password" }`

## 5. Acceptance Criteria (Given / When / Then)
- **Scenario 1: Registration Success**
  - **Given** a new email address `alice@example.com`.
  - **When** sending `POST /api/v1/auth/register` with valid password.
  - **Then** status 201 is returned and password is stored hashed with argon2 (not plaintext).
- **Scenario 2: Duplicate Registration Prevention**
  - **Given** an existing registered email.
  - **When** attempting registration with identical email.
  - **Then** status 409 Conflict is returned.
- **Scenario 3: Login Authentication**
  - **Given** registered user credentials.
  - **When** sending `POST /api/v1/auth/login`.
  - **Then** status 200 is returned with valid signed JWT.

## 6. Constraints
- Password Hashing: Argon2id or bcrypt (min 12 salt rounds).
- Secret Management: Read `JWT_SECRET` from `process.env`.
- Defense: Strict Bearer token validation matching hardened guard standards.

## 7. Anti-Scope
- ❌ No OAuth (Google/Apple login).
- ❌ No refresh tokens or persistent session databases.
- ❌ No email verification or password reset flows.
