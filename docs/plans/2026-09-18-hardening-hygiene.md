# jev-mcp hardening & hygiene

## Context

Repo evaluation (2026-09-18) found a well-designed MCP server (fail-closed gate, derived evidence, deterministic policy) with these gaps:

1. `redactText` (src/collector.ts:38) only catches `token|api_key|password|secret|private_key :` and `ts_/gh*_ /sk_` prefixes. Misses AWS keys (`AKIA…`), JWTs (`eyJ…`), Bearer headers, PEM private-key blocks, Slack `xox[baprs]-`, OpenAI `sk-…`, `Authorization:` headers. This is the only trust boundary before diffs leave for the TypeSafe API.
2. Three-way version drift: `src/version.ts`=0.1.0, `package.json`=0.2.0, README describes "v0.3 hardened advisory contract" (commit f9abc0b).
3. `jev_review` accepts both legacy flat v1 input and v2 `context` input via union schema. No deprecation signal for v1.
4. No lint/format tooling — only `tsc`.
5. No CI workflow (no `.github/`).
6. Generated artifacts unignored: `.sot/`, `GRAPH_REPORT.md`, `sot.db`, `cbm/`, `write.lock`.

Non-goals: no behavior change to gate logic, no new tools, no removal of `scripts/checkout-d-drive.ps1` (user's personal helper), no reformat-driven refactors beyond one mechanical pass.

## Approach

- Redaction: extend `redactText` with ordered regex rules — PEM blocks first (multi-line), then `Authorization:`/`Bearer` headers, then high-entropy token shapes (AKIA, JWT, xox*, sk-, ghp_/gho_/ghu_/ghs_/ghr_ already covered by gh[pousr]?), then the existing keyword `key: value` rule widened (`credential`, `passwd`, `client_secret`). Keep it conservative: redact only recognizable secret shapes, never arbitrary words.
- Version: single bump to `0.3.0` in `package.json` + `src/version.ts`.
- Deprecation: v1 review result gains `deprecated_input_schema: "v1"` field; tools.md + README note v1 input is deprecated, removal targeted for next minor.
- Tooling: Biome (`@biomejs/biome` devDep), `biome.json` matching existing style (2-space, double quotes, semicolons, ~100 col), `lint`/`format`/`check` scripts, one `biome check --write` pass.
- CI: `.github/workflows/ci.yml` — node 20/22 matrix, install, typecheck, lint, mock tests.
- Gitignore: `.sot/`, `*.db`, `cbm/`, `write.lock`, `GRAPH_REPORT.md`; delete `GRAPH_REPORT.md` from worktree.

## Critical files and ownership

| File | Task |
| --- | --- |
| `src/collector.ts` | T-01 redactText |
| `tests/collector.test.ts` | T-01 tests |
| `package.json`, `src/version.ts` | T-02 |
| `src/tools/review.ts`, `docs/tools.md`, `README.md` | T-03 |
| `biome.json`, `package.json` scripts | T-04 |
| `.gitignore`, `GRAPH_REPORT.md` | T-05 |
| `.github/workflows/ci.yml` | T-06 |

All edits sequential on main thread — small, overlapping package.json.

## Verification

- AC-01: `redactText` redacts AWS key, JWT, Bearer header, PEM block, `xoxb-`, `sk-` token; existing tests still pass; new unit tests assert each shape.
- AC-02: `package.json` version == `VERSION` == `0.3.0`.
- AC-03: v1 `runReview` result contains `deprecated_input_schema`; docs mention deprecation.
- AC-04: `npm run lint` exits 0; `npm run format` produces no diff on second run (idempotent).
- AC-05: `git status` clean of `.sot/`, `GRAPH_REPORT.md`, `sot.db`, `cbm/`, `write.lock`.
- AC-06: `ci.yml` valid YAML, runs typecheck+lint+test.
- AC-07: `npm run typecheck` + `JEV_MCP_MOCK=1 npm test` green after all changes.

## Execution checklist

- [x] T-01 Expand redactText + tests → AC-01
- [x] T-02 Align version to 0.3.0 → AC-02
- [x] T-03 Deprecate v1 review input → AC-03
- [x] T-04 Biome config + format pass → AC-04
- [x] T-05 Gitignore + remove GRAPH_REPORT.md → AC-05
- [x] T-06 CI workflow → AC-06
- [x] T-07 Final verification via test-runner → AC-07

## Evidence and handoff

Baseline (pre-change): typecheck clean, build clean, 55/56 tests pass (1 skip = live e2e).

Post-change (test-runner receipt, 2026-09-18):

- `npm run typecheck` → exit 0
- `npm run lint` (biome check) → exit 0, 53 files
- `JEV_MCP_MOCK=1 npm test` → exit 0, 57 pass / 0 fail / 1 skip (live e2e)
- `npm run build` → exit 0

AC-01: `redactText` now covers PEM blocks, `Authorization:`/`Bearer` headers, AWS `AKIA…`, JWTs, Slack `xox*`, `sk-/pk-/rk-/key-` tokens, and a widened keyword list (`passwd`, `credential`, `client_secret`, `access_key`). New tests in `tests/collector.test.ts` assert each shape plus a no-false-positive case on ordinary code.
AC-02: `package.json` and `src/version.ts` both `0.3.0`.
AC-03: v1 `runReview` result carries `deprecated_input_schema: "v1"`; deprecation documented in `docs/tools.md` and `README.md`.
AC-04: `biome.json` (2-space, double quotes, 120 col); `npm run lint`/`format`/`check` scripts; one-time format pass touched 41 files, lint clean.
AC-05: `.gitignore` covers `.sot/`, `sot.db`, `cbm/`, `write.lock`, `GRAPH_REPORT.md`; report file deleted.
AC-06: `.github/workflows/ci.yml` — node 20/22 matrix: `npm ci` → typecheck → lint → mock tests.

Residual risks: redaction is regex-based and cannot catch every secret shape (e.g. base64 blobs without recognizable prefix); adapters remain responsible for not sending secrets. `scripts/checkout-d-drive.ps1` intentionally kept.

## Assumptions and contingencies

- Biome format pass may touch many files; acceptable one-time diff. If it produces semantic-looking changes, revert and restrict to lint-only.
- `scripts/checkout-d-drive.ps1` kept as-is (user file).
