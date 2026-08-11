# Reusable CLI Option Validation Design

**Goal:** Reuse consistent option-relationship validation for `acu set-org` and monitor period options.

**Architecture:** Add small validators for option groups (`at least one`, `together`, and `mutually exclusive`) in `src/utils/cliOptions.ts`. Commands retain domain-specific parsing and error messages while delegating relationship checks to the shared helpers.

**Testing:** Add unit tests for the validators and command-level tests for `acu set-org`; preserve and extend monitor period validation coverage.

## Implementation plan

1. Add failing tests for shared validators: at least-one, together, and mutually-exclusive behavior.
2. Add failing command tests for `acu set-org`: local-only, cloud-only, both, and neither.
3. Implement the shared validators.
4. Update `acu set-org` to use optional flags plus `requireAtLeastOne`.
5. Refactor monitor period validation to use shared validators while preserving errors and return types.
6. Run focused tests, full tests, type-check, and build.
