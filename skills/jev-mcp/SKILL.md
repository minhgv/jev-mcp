---
name: jev-mcp
description: >
  Use the jev-mcp MCP server for bounded, typed Jev judgments while coding.
  It routes coding-loop decisions, reviews diffs, assesses change risk, checks requirements,
  classifies issues, verifies claims, screens untrusted text, and ranks host-supplied candidates.
  Jev does not write code or inspect the repository.
---

# Use Jev while coding

Jev is a typed decision model. It returns Choice / Score / Noul answers with probabilities and confidence. The host agent still owns code generation, file edits, Git, tests, and explanations.

## Shared boundary

The MCP server is repository-blind and read-only. The host or wrapper must collect a bounded context bundle, redact secrets, identify truncation, and pass requirements/tests/evidence explicitly. Never ask this server to run Git or inspect the whole tree.

For a change, capture a baseline before work and include the baseline-to-current diff plus relevant untracked source/docs. Exclude `.env*`, credentials, private keys, tokens, `node_modules`, `.next`, `dist`, and build output.

## Tool selection

- `jev_coding_loop` before a frontier retry/stop/model-tier/focus decision.
- `jev_review` for the canonical diff review gate before declaring a patch done. There is no separate `jev_check_diff` tool.
- `jev_assess_change_risk` for protected paths, security, operational impact, compatibility, reversibility, scope drift, and blast radius.
- `jev_check_requirement` for criterion-level covered/partial/not_covered/not_verifiable results.
- `jev_classify_issue` for category, severity, urgency, and an allowlisted owner candidate. It may return `unknown`; never invent ownership.
- `jev_verify` for claims against supplied evidence.
- `jev_screen` before reading untrusted fetched or pasted text.
- `jev_rank` when choosing among a bounded candidate list supplied by the host.
- `jev_evaluate` only when no recipe fits; keep questions atomic.

Keep risk, requirement, and issue classification as separate calls. Do not flatten them into one generic review question.

## Policy handling

- `action: auto` — proceed only within the host’s configured policy.
- `action: review` — inspect evidence and run deterministic checks; ask for human review when stakes are high.
- `action: escalate` — do not guess; route to a stronger reasoning or human path.

High-risk/security-sensitive changes, protected paths, missing evidence, redaction/truncation, and low confidence must not silently become `auto`. Compiler, tests, AST checks, SAST, and dependency checks remain authoritative deterministic gates.

## Do not

- Ask Jev to write code, explanations, commit messages, or shell commands.
- Treat a Jev probability as ground truth.
- Send secrets, credentials, private keys, or unbounded repository state.
- Ask Jev to count, calculate, or compare dates; do that in code.
- Claim a review passed when the result is `review`, `escalate`, truncated, or missing required evidence.

## Official docs

- https://docs.typesafe.ai/introduction.md
- https://docs.typesafe.ai/model-jaggedness/jev-1.13.md
