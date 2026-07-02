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
DEVIN_API_BASE_URL=https://servicenow.devinenterprise.com/api
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

# Set exactly one org for a user (adds target, removes all others)
# NOTE: see Known Gaps — use --dry-run to preview until gap #1 is resolved
devin-admin membership set-only <user_id> --org <org>
devin-admin --dry-run membership set-only <user_id> --org <org>
```

---

### `monitor` — consumption

```bash
# Enterprise-wide ACUs for a month vs an org's cycle limit
devin-admin monitor org <org> --month 2026-06

# Per-user ACU breakdown by product (devin / cascade / terminal / review)
devin-admin monitor user <user_id> --month 2026-06

# Machine-readable output
devin-admin --json monitor user <user_id> --month 2026-06
```

---

## Known gaps

1. **`membership set-only` (live)** — The remove-from-org API endpoint is not yet documented. The command works in `--dry-run` mode but will error on a live run until the endpoint is confirmed and wired in `src/api/MembersApi.ts`.

2. **Per-org consumption** — The Devin API only exposes enterprise-wide daily consumption; there is no per-org filter. `monitor org` shows enterprise totals alongside the org's cycle limit. Per-user data is fully available with per-product breakdown.

3. **Per-model consumption** — The API returns ACUs by product (`devin`, `cascade`, `terminal`, `review`), not by LLM model. Per-model data would require a future API addition.

---

## Contributing / development

```bash
npm run dev -- <command>   # run against source directly (no build step)
npm test                   # unit tests with mocked HTTP — no live API calls
npm run lint               # type-check without emitting
```
