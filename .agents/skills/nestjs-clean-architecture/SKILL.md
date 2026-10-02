---
name: nestjs-clean-architecture
description: Apply strict four-layer Clean Architecture when adding features or new behavior to the Dental Hub Backend's NestJS modules.
---

# NestJS Clean Architecture for Dental Hub Backend

Use this skill for new features and new behavior in this NestJS, TypeScript, and TypeORM backend. Inspect the feature's current module, neighboring code, and tests first. Existing modules may use a simpler controller/service/repository arrangement; preserve their public contracts and do not migrate unrelated code as part of a focused change.

## Layer boundaries

Organize new feature behavior under its feature module in `src/<feature>/`:

- **Domain** holds business concepts, invariants, and domain policies. Keep it independent of NestJS, TypeORM, HTTP, and external SDKs.
- **Application** holds use cases and the ports they need, including persistence and external-service contracts. It orchestrates domain behavior and depends only on the domain layer.
- **Infrastructure** implements application ports with TypeORM repositories, persistence mapping, and external-service adapters. Keep ORM entities and query details here.
- **Presentation** holds NestJS controllers and HTTP request/response DTOs. Validate and map transport data at this boundary, then delegate to application use cases.

Dependencies point inward: application depends on domain; infrastructure and presentation depend on application and, where needed, domain. Presentation must not call TypeORM or infrastructure adapters directly. Domain and application must not import infrastructure or presentation types.

Treat the Nest feature module as the composition root: register controllers and infrastructure adapters there and bind application ports to their implementations. Keep domain and application classes free of Nest decorators; use explicit Nest provider tokens and factory providers when needed to construct use cases with port implementations.

## Pattern selection

Use a pattern when it creates a real boundary or makes a changing behavior easier to isolate:

- Use a **Repository port and adapter** to keep application use cases independent of TypeORM and persistence details.
- Use an **Adapter** to translate an external SDK or provider into an application-owned contract.
- Use a **Strategy** when multiple interchangeable algorithms or provider behaviors must be selected.
- Use a **Policy** when a cohesive business rule needs a named home or independent reuse and testing.

Do not add a pattern, interface, base class, or extra layer solely to satisfy a checklist. Keep single-use orchestration in its use case; avoid leaking ORM query builders, HTTP DTOs, or provider SDK models inward.

## Errors and tests

Keep domain and application failures independent of HTTP. Translate them to NestJS HTTP exceptions in presentation; translate persistence or provider failures at their adapter boundary without leaking driver details.

When tests are part of the task, follow the existing Jest/ts-jest conventions. Test domain rules as plain TypeScript, application use cases through fake ports, and infrastructure mapping or persistence behavior at the adapter boundary. Keep controllers thin and test their transport mapping and response contract where relevant.
