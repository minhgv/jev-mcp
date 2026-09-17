# Tools

Every tool returns JSON with the common fields:

- `schema_version`, `tool`, `pack`, and `policy` — versioned result contract
- `model` and `usage.input_tokens` / `usage.output_tokens`
- `truncated` — model or host context was cut
- `action` — `auto` | `review` | `escalate`
- `missing_evidence` and `limitations` when evidence is incomplete or redacted

The server evaluates only supplied state. It does not run Git, inspect files, execute commands, or apply changes. Question templates are MCP resources at `jev://packs/{coding-loop,review,verify,screen,rank,change-risk,requirement,issue}`.

## `jev_coding_loop`

Call before spending a frontier turn on retry / stop / model tier.

Arguments: `task`, `observation`, optional `extras`, thresholds, and `model`.

Fan-out: `next` (`continue` | `retry` | `ask_user` | `stop`), `model_tier`, `focus`, risk score, and Noul signals for done-enough, context, and likely test failure. `ask_user` is always `review`; high risk is never `auto`.

## `jev_review`

The canonical diff review gate. Call before declaring a patch done. It does not apply the patch and there is no separate `jev_check_diff` tool.

Arguments:

- `request`, `diff`
- optional `tests`, `changed_files`, `repository_context`
- `evidence_complete`, `truncated`, and `context_version`
- optional thresholds and `model`

Scores: `correctness`, `spec_match`, `test_gap`, and `blast_radius` use 0–2 rubrics, plus Noul `safe_to_apply`. The deterministic policy combines them. Host-marked incomplete or truncated evidence forces at least `review`.

## `jev_assess_change_risk`

Assess a proposed change independently from correctness review.

Required context: `request`, `diff`. Recommended context: `changed_files`, `tests`, `repository_context`, `deployment_context`, and explicit evidence flags.

Returns:

- `risk.level`: `low` | `medium` | `high`
- security sensitivity, operational impact, compatibility risk
- reversibility, scope drift, and human-review signal
- confidence, missing evidence, and deterministic action

High risk, security-sensitive changes, low confidence, protected-path changes, or incomplete evidence never silently return `auto`.

## `jev_check_requirement`

Check each supplied requirement or acceptance criterion against a host-supplied diff and verification evidence.

Arguments: `requirements: [{ id, text }]`, `diff`, optional `tests` and `repository_context`, plus evidence flags.

Each criterion returns `covered`, `partial`, `not_covered`, or `not_verifiable`, confidence, probabilities, and the evidence fields used. Any `not_covered` criterion escalates; partial or unverifiable criteria require review.

## `jev_classify_issue`

Classify an issue without inventing ownership.

Arguments: `issue`, required `owner_candidates`, optional `evidence` / `repository_context`, and evidence flags.

Returns category, severity, urgency, `needs_reproduction`, an owner selected only from the supplied allowlist (including `unknown`), and aggregate confidence. Missing evidence prevents automatic continuation.

## `jev_verify`

Check factual claims against supplied evidence such as PR text, docs, logs, or diffs. Per claim: `verified` | `contradicted` | `unsupported`, probabilities, confidence, and action. Auto-contradictions escalate.

## `jev_screen`

Judge untrusted paste/fetch before the agent reads it. Skip first-party repo files. Noul signals cover injection, substance, and optional relevance. `block` maps to MCP `escalate`.

## `jev_rank`

Rank a bounded candidate list already collected by the host. No embeddings and no repository index. Candidates are capped and chunked by the existing limits.

## `jev_evaluate`

Escape hatch for a custom typed question map. Keep questions atomic, use closed Choice options, keep arithmetic in code, and send only small relevant state.
