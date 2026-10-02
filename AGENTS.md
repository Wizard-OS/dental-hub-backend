# Repository implementation standards

Before implementing or changing application code in this repository, read and apply both project skills:

- [Clean code](.agents/skills/clean-code/SKILL.md)
- [NestJS Clean Architecture](.agents/skills/nestjs-clean-architecture/SKILL.md)

For new features and new behavior, follow the four-layer architecture in the NestJS skill. When extending an existing feature, keep the change scoped: put new behavior behind the appropriate layer boundaries, preserve existing contracts, and do not migrate unrelated code solely to conform to the new structure. Use judgment for a narrowly scoped fix where introducing new layers would add structure without improving the change.
