# Technical Explanation: REST-to-GraphQL Migration

## Decision Summary
**We are migrating ShopStream's public-facing API from REST to GraphQL over an 8-week dual-run transition.** This architectural migration will reduce frontend network requests by 40%, eliminate 15 single-purpose data aggregation endpoints, and give our web and mobile apps direct control over the exact data shapes they query.

---

## Why We Chose This

### 1. Eliminating Frontend Over-Fetching and Single-Use Endpoints
Currently, our REST API has 47 endpoints—15 of which exist solely to serve specialized mobile UI screen layouts. Frontend engineers currently spend roughly 30% of each sprint building and maintaining these custom aggregation endpoints. 

While **REST** (Representational State Transfer) acts like a fixed restaurant menu where each endpoint returns a predetermined set of fields regardless of what the screen actually needs, **GraphQL** acts like a buffet: client applications send a single POST request describing the exact fields they require, eliminating over-fetching and multi-request waterfall latency.

### 2. Evaluated and Rejected Alternatives
We evaluated two alternative architectural solutions before selecting GraphQL:
- **Backend-for-Frontend (BFF) Layer:** Rejected because deploying and monitoring separate proxy services for web and mobile introduces substantial operational overhead.
- **REST Schema Standardization:** Rejected because it cannot solve the core requirement of web and mobile clients naturally needing different data granularities for identical entity domains.

---

## Risks and Mitigations

| Identified Risk | Severity | Root Cause | Concrete Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Team Learning Curve** | Medium | 2 of 3 backend engineers on the project are new to GraphQL. | We established paired programming rotations and allocated dedicated schema-design spike tickets during Sprint 1. |
| **Unbounded Query Depth** | High | Clients can request deeply nested relational graphs, risking database CPU exhaustion. | We enforce static query complexity analysis and depth-limiting middleware (maximum depth of 5 levels) at the gateway layer. |
| **HTTP Caching Invalidation** | Medium | GraphQL routes through a single POST endpoint (`/graphql`), bypassing traditional HTTP URL-based caching. | We implement client-side normalized caching (Apollo Client) alongside Redis persisted query caching on high-throughput read paths. |

---

## What This Means for Priya

As our newest backend engineer, you will directly participate in building and hardening the new GraphQL schema:
- **Core Focus:** You will help define schema types, write entity resolvers using Prisma, and implement query complexity safeguards.
- **Dual-Run Coexistence:** You do not need to rewrite existing REST controllers immediately. Both the REST API and GraphQL gateway will run simultaneously throughout the 8-week migration.
- **Onboarding Support:** You are paired with senior engineer Marcus for your first two sprints to ramp up on our GraphQL tooling and resolver conventions.

---

## Next Steps

1. **Clone and Run the Development Gateway:** Check out the `feature/graphql-gateway` branch and run `pnpm start:graphql` to explore the Apollo Studio playground locally.
2. **Review the Core Schema RFC:** Read our baseline schema definition in [`docs/architecture/graphql-schema-v1.md`](file:///D:/Caw%20Studios/upsk-system-design-workspace/docs/architecture/graphql-schema-v1.md).
3. **Join the Daily Migration Standup:** Marcus will invite you to the 10:30 AM daily sync on the `#proj-graphql-migration` Slack channel starting Monday.
