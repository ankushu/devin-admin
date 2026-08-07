# devin-admin

CLI for Devin Enterprise administration — manage ACU limits, org memberships, and consumption monitoring across multiple organizations.

## Setup

```bash
npm install
npm run build
npm link          # registers `devin-admin` as a global command
```

Copy `.env.example` to `.env` and fill in your token:

```
DEVIN_API_TOKEN=<your token>
DEVIN_API_BASE_URL=https://api.devin.com/
ORG_CACHE_PATH=./data/orgs.json
```

The `.env` file is read automatically from wherever you run `devin-admin`.

## Usage

```bash
devin-admin <command> [subcommand] [options]
```

### Inputs

| Argument | Accepted values | Resolution |
|---|---|---|
| `<org>` | Org name **or** `org-…` id | Resolved via local cache (`orgs list`) |
| `<user>` | User email **or** `user-…` id | Email → looked up via enterprise members API |

### Global flags

| Flag | Effect |
|---|---|
| `--json` | Output raw JSON instead of tables |
| `--dry-run` | Print the intended API request without executing it (safe preview for all mutating commands) |

---

### `orgs` — organization cache

Organizations are cached locally so you don't hit the API on every command. The cache is auto-populated on first use.

```bash
devin-admin orgs list              # load from cache (auto-fetches if empty)
devin-admin orgs list --refresh    # force refresh from API
devin-admin orgs refresh           # same as above, explicit
```

---

### `acu` — ACU limits

`<org>` accepts either an `org-…` id or the friendly org name.

```bash
# Org limits
devin-admin acu get-org <org>
devin-admin acu set-org <org> --local 500
devin-admin acu set-org <org> --local 500 --cloud 1000
devin-admin acu clear-org <org>

# User limits
devin-admin acu get-user <user_id>
devin-admin acu set-user <user_id> --local 200
devin-admin acu set-user <user_id> --local 200 --billing-org <org>
devin-admin acu clear-user <user_id>

# Enterprise-wide default (applies to users without an explicit limit)
devin-admin acu get-default
devin-admin acu set-default --local 100

# Preview any mutating command before running it
devin-admin --dry-run acu set-org "My Org" --local 500
```

---

### `membership` — org membership

```bash
# Add a user to an org
devin-admin membership assign <user_id> --org <org>
devin-admin membership assign <user_id> --org <org> --role admin

# Remove a user from an org (with confirmation)
devin-admin membership remove <user_id> --org <org>

# Set exactly one org for a user (adds target, removes all others)
# NOTE: see Known Gaps — use --dry-run to preview until gap #1 is resolved
devin-admin membership set-only <user_id> --org <org>
devin-admin --dry-run membership set-only <user_id> --org <org>

# Get user details and org memberships
devin-admin membership get-user <user_id>

# List all users in an org
devin-admin membership list-users --org <org>

# Update billing org for a user's ACU limit
devin-admin membership set-billing-org <user_id> --billing-org <org>
```

---

### `monitor` — consumption

```bash
# Enterprise-wide ACUs for a month vs an org's cycle limit
devin-admin monitor org <org> --month 2026-06

# Per-user ACU breakdown by product (devin / cascade / terminal / review)
devin-admin monitor user <user_id> --month 2026-06

# Date range mode (start/end are inclusive), includes daily trend output
devin-admin monitor org <org> --start 2026-06-01 --end 2026-06-30
devin-admin monitor user <user_id> --start 2026-06-01 --end 2026-06-30

# Daily/weekly/monthly active users for an org
devin-admin monitor dau <org> --month 2026-06
devin-admin monitor wau <org> --month 2026-06
devin-admin monitor mau <org> --month 2026-06

# Machine-readable output
devin-admin --json monitor user <user_id> --month 2026-06
```

`monitor org`, `monitor user`, `monitor dau`, `monitor wau`, and `monitor mau` accept either `--month <YYYY-MM>`
or `--start <YYYY-MM-DD> --end <YYYY-MM-DD>`. Do not mix both modes. In date range mode, `--start` and `--end`
are both required and both inclusive.

`monitor dau`/`wau`/`mau <org>` derive daily/ISO-week/calendar-month distinct active-user counts from
per-user ACU consumption — see Known gap #4 below. They print progress to stderr (one API call per org
member) and each individual request times out after `REQUEST_TIMEOUT_MS` (default 30s, configurable in
`.env`) instead of hanging indefinitely. A per-user fetch that fails is retried up to 2 more times; if it
still fails, that user is excluded from the active-user counts and printed in a separate "Failed to fetch
consumption after retries" table (and a `failedUsers` array in `--json` output) so it can be checked manually.

---

## Known gaps

1. **`membership set-only` (live)** — The remove-from-org API endpoint is not yet documented. The command works in `--dry-run` mode but will error on a live run until the endpoint is confirmed and wired in `src/api/MembersApi.ts`.

2. **Per-org consumption** — The Devin API only exposes enterprise-wide daily consumption; there is no per-org filter. `monitor org` shows enterprise totals alongside the org's cycle limit. Per-user data is fully available with per-product breakdown.

3. **Per-model consumption** — The API returns ACUs by product (`devin`, `cascade`, `terminal`, `review`), not by LLM model. Per-model data would require a future API addition.

4. **Active users (`monitor dau`/`wau`/`mau`)** — There is no bulk active-users endpoint and no per-tool (Desktop/CLI/Cloud) consumption breakdown. These commands work around this by listing org members and calling the per-user consumption endpoint for each one (N API calls per run, retried up to 2x on failure), counting a user as active on a day if their ACUs for that day are > 0. This undercounts users who exclusively use non-premium/free models that don't consume ACUs — the commands always print a warning to this effect, and separately list any users whose fetch still failed after retries for manual follow-up.

---

## Shell completion (zsh)

A static zsh completion script for commands, subcommands, and flags is at `completions/_devin-admin`.

```bash
fpath=(/path/to/devin-admin/completions $fpath)
autoload -Uz compinit && compinit
```

Or copy `completions/_devin-admin` into an existing `fpath` directory (e.g. `~/.zsh/completions/`).

It does not complete `<org>`/`<user>` values (those are free-form) — only command names and flags. Keep it in sync whenever commands, subcommands, or flags change in `src/cli/commands/*.ts`.

---

## Contributing / development

```bash
npm run dev -- <command>   # run against source directly (no build step)
npm test                   # unit tests with mocked HTTP — no live API calls
npm run lint               # type-check without emitting
```
