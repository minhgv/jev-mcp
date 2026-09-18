# jev-mcp

MCP server that puts [TypeSafe Jev](https://docs.typesafe.ai/introduction.md) on the coding loop for OpenCode, OMP, Cursor, Codex, CI, and other MCP clients.

Jev is a typed decision model, not a coding agent. The host owns files, Git, shell, code generation, and context collection. `jev-mcp` sends bounded state plus typed Choice / Score / Noul questions to Jev, then applies deterministic policy in TypeScript.

## Tools

| Tool | Use when |
| --- | --- |
| `jev_coding_loop` | Decide retry / stop / model tier / focus before spending a frontier turn |
| `jev_review` | Canonical diff review before declaring a change done; no `jev_check_diff` alias is needed |
| `jev_assess_change_risk` | Assess security, operational, compatibility, scope, reversibility, and blast-radius risk |
| `jev_check_requirement` | Check requirements and acceptance criteria against a diff and verification evidence |
| `jev_classify_issue` | Classify category, severity, urgency, and an allowlisted owner candidate |
| `jev_verify` | Check claims against supplied evidence |
| `jev_screen` | Screen untrusted fetched or pasted text before the agent reads it |
| `jev_rank` | Rank a candidate list supplied by the host |
| `jev_evaluate` | Escape hatch for a custom typed question pack |

Every tool returns typed answers, usage, truncation metadata, and a deterministic `action`:

- `auto` — the configured policy permits automated continuation.
- `review` — more evidence or human/agent review is required.
- `escalate` — do not guess; route to a stronger governance or human path.

Question packs are exposed as resources at `jev://packs/{coding-loop,review,verify,screen,rank,change-risk,requirement,issue}`.

## Diff-gate boundary

`jev-mcp` does **not** read the repository, run Git, execute shell commands, or apply patches. An OpenCode plugin, OMP extension, CLI, or CI wrapper must build the context bundle and call `jev_review`.

The host-side context builder should:

1. Snapshot a baseline commit before the task.
2. Collect baseline-to-current changes, including relevant untracked source/docs.
3. Exclude generated/build/dependency artifacts.
4. Redact secrets and report redaction or truncation explicitly.
5. Attach requirements, tests, and verification output.
6. Send only the bounded context needed for the selected tool.

The server validates and evaluates the supplied context; it does not assume that missing evidence means “no problem.”

## v0.3 hardened advisory contract

The `context` adapter and v2 `jev_review` path implement the hardened preview contract:

- `context_schema_version: "2"` requires repository/subject identity, complete file manifest, section-level truncation/redaction, verification records, provenance, policy profile, and structured risk signals.
- Protected paths (`auth/`, `security/`, `billing/`, `database/`, `migration/`, `permission/`, `network/`, `deployment/`, secrets) are classified deterministically and cannot be omitted from the manifest.
- Evidence completeness is derived from the manifest, sections, required checks, test subject revision, and trusted verification records; caller booleans are not authoritative.
- `jev_review` v2 returns `result_schema_version: "2"`, `gate_eligibility`, stable reason codes, typed limitations, resolved provenance, and risk signals. Malformed Jev output fails closed.
- Only a server-configured trusted adapter can be CI gate-eligible. Specialist tools remain advisory and never grant a merge/deploy gate.

The adapter/CI helper runs outside the repository-blind MCP server:

```bash
node dist/index.js context --request "Review this change" --profile ci
JEV_MCP_MOCK=1 node dist/index.js ci-shadow --request "Review this change"
```

`ci-shadow` is intentionally non-blocking: it reports `would_block` and the v2 result but exits successfully. Set `JEV_MCP_TRUSTED_ADAPTERS` only in a controlled server environment; the caller cannot self-authorize trust. Production blocking CI and automatic acceptance remain disabled until shadow evidence is calibrated.

## Quick start

Node 20+:

```bash
npm install
npm run build
node dist/index.js doctor
```

For local deterministic tests without a key:

```bash
JEV_MCP_MOCK=1 npm test
JEV_MCP_MOCK=1 node dist/index.js eval --json '{
  "state": "Help! Payouts have been failing for 3 days.",
  "questions": {
    "urgent": { "type": "noul", "instructions": "Is this urgent?" }
  }
}'
```

For live evaluation, provide `TYPESAFE_API_KEY` through the MCP host environment. Never commit or print it.

## OpenCode

Add one local MCP server entry. All tools are exposed from the same process:

```json
{
  "mcp": {
    "jev-mcp": {
      "type": "local",
      "command": ["node", "/absolute/path/to/jev-mcp/dist/index.js"],
      "environment": {
        "TYPESAFE_API_KEY": "{env:TYPESAFE_API_KEY}"
      },
      "enabled": true
    }
  }
}
```

Use `jev_review` for the canonical diff gate. Use `jev_assess_change_risk` for governance/risk decisions and `jev_check_requirement` for traceability; do not merge these question packs into one generic review.

## OMP

Reuse the same server or a thin CLI adapter around the same core. The shared skill belongs in the configured OMP skill directories. OMP’s `@advisor` remains a strategic text/planning model; Jev is the typed quality and safety decision layer beside it.

## Environment

| Variable | Role |
| --- | --- |
| `TYPESAFE_API_KEY` | Live TypeSafe API credential |
| `JEV_MCP_MODEL` | Default `jev-latest` |
| `TYPESAFE_BASE_URL` | Optional API root |
| `JEV_MCP_MOCK` | `1` enables deterministic local mock mode |
| `JEV_MCP_AUTO_ACCEPT` | Default automation threshold: `0.8` |
| `JEV_MCP_REVIEW_AT` | Default review threshold: `0.5` |
| `JEV_MCP_BLOCK_AT` | Screen block threshold: `0.75` |
| `JEV_MCP_TRUSTED_ADAPTERS` | Comma-separated server-side adapter IDs allowed to be CI gate-eligible; default empty |

## Development

```bash
npm test
npm run typecheck
npm run build
```

Tests are mock-first and do not require a live key. Live tests are opt-in and must use sanitized fixtures:

```bash
TYPESAFE_API_KEY=... npm test
```

## Design rules

- Keep the MCP server repository-blind and read-only.
- Keep question packs tool-specific; do not turn every tool into `jev_review`.
- Keep policy deterministic and independently unit-testable without a network call.
- Treat probability/confidence as signals, not truth.
- Missing, redacted, or truncated evidence must remain visible in the result.
- Arithmetic, counts, and date calculations stay in TypeScript.
- Never ask Jev to write code, prose, commit messages, or explanations.

## Documentation

- [Architecture](docs/architecture.md)
- [Tools](docs/tools.md)
- [Context v2/result v2 contract](docs/context-v2.md)
- [Install](docs/install.md)
- [Configuration](docs/configuration.md)
- [Agent skill](skills/jev-mcp/SKILL.md)
- [AGENTS.md](AGENTS.md)
