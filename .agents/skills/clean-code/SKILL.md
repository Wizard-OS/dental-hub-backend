---
name: clean-code
description: Apply focused clean-code practices when implementing or changing code in the Dental Hub Backend. Use alongside nestjs-clean-architecture for application work.
---

# Clean Code for Dental Hub Backend

Use this skill for implementation and code changes in this repository. First inspect the target code, its callers, nearby specifications, and the relevant TypeScript, ESLint, and Prettier configuration. Preserve established behavior and local conventions unless the task asks to change them.

## Writing and changing code

- Choose names that describe the domain intent and responsibility. Avoid vague names such as `data`, `manager`, or `helper` when a more specific name fits.
- Keep functions and classes cohesive. Extract a concept when it clarifies responsibilities or gives behavior a useful name; avoid wrappers, generic utility layers, and abstractions created only for hypothetical reuse.
- Make branching, validation, mutation, and failure paths easy to follow. Do not silently swallow errors or expose internal details in user-facing responses.
- Prefer explicit types at public boundaries and for non-obvious data shapes. Keep straightforward local inference; avoid `any` when an existing type or a small explicit type can describe the value.
- Keep constants and configuration visible rather than embedding meaningful domain values in expressions.
- Add comments to explain constraints or non-obvious reasons, not to paraphrase the code.
- Limit edits to the requested behavior. Reuse existing domain rules when appropriate, and avoid unrelated cleanup or duplicate abstractions.

## Project conventions

- Follow the repository's TypeScript, ESLint, and Prettier configuration rather than introducing local style rules.
- Keep feature code with its feature under `src/`; follow nearby naming and import conventions.
- When tests are part of the task, use the existing Jest/ts-jest conventions and place specifications with the relevant feature, following nearby `*.spec.ts` files.

## Imports

- Group imports in this order, with one blank line between nonempty groups: Node built-ins; external dependencies (including NestJS); internal absolute imports or aliases; relative imports.
- Use the repository's ESLint import sorter for consistent ordering within each group. Prefer `node:` for new built-in imports; do not rewrite existing module paths solely for style.
- Preserve the relative order of side-effect imports. Keep them in the separate leading group expected by the sorter, and review initialization-sensitive modules before reordering any imports.
- Keep type-only imports in their source group. Use `import type` for types erased at runtime, but retain runtime imports needed by decorators, NestJS dependency injection, or emitted metadata. Do not bulk-convert imports to type-only imports.
- Import through appropriate feature and architecture boundaries; a sorted import must still respect the NestJS Clean Architecture skill's dependency rules. Do not introduce aliases or change import paths just to create a group.

```typescript
import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';

import { apiMessage } from 'src/common/i18n/api-message';

import { User } from './entities/user.entity';
```

The internal absolute import above illustrates grouping when such imports are already appropriate; keep existing relative paths when changing nearby code.

## Readable spacing

- Keep related variable declarations together. Add one blank line between a declaration group and subsequent control flow or operations.
- Separate guards from surrounding statements, including before an `if` and after it when another statement follows. Separate a `return` or `throw` from preceding statements in the same block.
- Separate function declarations and class methods, including constructors, with one blank line. Keep overload signatures together, and do not force blank lines between consecutive class fields.
- Use one blank line between distinct logical steps, such as updating an account and revoking sessions. Keep closely related statements together; do not mechanically separate every `await` or every declaration.
- Let ESLint enforce structural spacing and Prettier handle formatting. Logical boundaries between operations still require judgment; avoid extra blank lines inside expressions or immediately inside blocks.

```typescript
const passwordHash = await this.passwordHasher.hash(newPassword);
const sessionId = this.requireCurrentSessionId(user);

await this.securityTransactions.withLockedAccountById(user.id, async (locked) => {
  const account = locked?.account;

  if (!locked || !account) return;

  await locked.update({ password: passwordHash });

  await locked.revokeSessions(sessionId);
});
```

Before finishing, review the changed code for clear names, cohesive responsibilities, unnecessary indirection, preserved behavior, and consistency with nearby files.
