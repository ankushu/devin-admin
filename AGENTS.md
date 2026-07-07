# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`devin-admin` — a CLI for Devin Enterprise administration: managing ACU limits, org membership, and consumption monitoring across multiple organizations. Node/TypeScript, ESM, built on Commander.

## Commands

```bash
npm run dev -- <command>   # run against source directly via tsx, no build step
npm run build               # tsc compile to dist/
npm test                    # vitest run (all tests, mocked HTTP — no live API calls)
npx vitest run tests/AcuLimitService.test.ts   # run a single test file
npm run lint                 # tsc --noEmit (type-check only)
npm link                     # after build, registers `devin-admin` globally
```

Requires a `.env` with `DEVIN_API_TOKEN`, `DEVIN_API_BASE_URL`, `ORG_CACHE_PATH` (see `.env.example`). Config is validated with zod in `src/config/config.ts` and the process exits with a readable error if required vars are missing.

## Architecture

**Layering:** `cli/commands` (Commander definitions, parsing/printing only) → `services/*` (business logic, one per domain: `AcuLimitService`, `MembershipService`, `MonitoringService`) → `api/*` (thin wrappers per Devin API resource: `OrganizationsApi`, `MembersApi`, `AcuLimitsApi`, `ConsumptionApi`) → `http/DevinHttpClient` (single HTTP client implementing `IHttpClient`).

Everything is wired manually in `src/container.ts` (`buildContainer()`) — no DI framework. When adding a new API/service, register it there and inject into the CLI command layer rather than constructing dependencies inline in command files.

**Org and user resolution** — commands accept either a friendly name/email or a raw id; resolution is centralized so this logic doesn't need to be duplicated in each command:
- `OrgRegistry` (`src/orgs/OrgRegistry.ts`) resolves an org name-or-id against a locally cached list (`ORG_CACHE_PATH`, default `./data/orgs.json`). Cache is populated lazily on first use, or explicitly via `orgs refresh` / `--refresh`. Always goes through `orgRegistry.resolve()`/`.get()` — don't hit `OrganizationsApi` directly from services.
- `UserResolver` (`src/users/UserResolver.ts`) resolves an email to a `user_id` via `MembersApi.listEnterpriseMembers`; a bare id (no `@`) passes through untouched.

**Global flags** (`--json`, `--dry-run`) are declared once on the root `program` in `src/cli/index.ts` and read from command action handlers via `.optsWithGlobals()` (not re-declared per subcommand). `--dry-run` short-circuits mutating commands before the HTTP call — use `renderDryRun()` from `src/utils/output.ts` to preview the method/path/body instead of executing.

**Output rendering** is centralized in `src/utils/output.ts` (`renderJson`, `renderTable`, `renderKV`, `renderDryRun`) — commands should render through these rather than `console.log`ing ad hoc, so `--json` stays consistent across commands.

## Shell completion

`completions/_devin-admin` is a hand-authored, static zsh completion script (no built-in Commander support). Whenever a command, subcommand, or flag is added/renamed/removed in `src/cli/commands/*.ts` or `src/cli/index.ts`, update this file to match — it is not generated automatically.

## Known gaps (see README for detail)

- `membership set-only` has no live remove-from-org endpoint wired yet in `MembersApi` — only works in `--dry-run` until the endpoint is confirmed.
- The Devin API has no per-org consumption filter; `monitor org` shows enterprise-wide totals alongside the org's limit, not a true per-org breakdown. Per-user consumption (by product: devin/cascade/terminal/review) is fully available.
- No per-model consumption data exists in the API.
