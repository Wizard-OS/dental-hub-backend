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

Before finishing, review the changed code for clear names, cohesive responsibilities, unnecessary indirection, preserved behavior, and consistency with nearby files.
