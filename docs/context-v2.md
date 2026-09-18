# Context v2 and result v2

This contract is the boundary between a host adapter and the repository-blind MCP server.

## Context v2

Required top-level fields:

- `context_schema_version: "2"`
- `repository`, `comparison`, `request`, `diff`, `subject_digest`
- `manifest.complete`, `manifest.files[]`, `manifest.omission_reasons`
- `sections[]` with per-section `available`, `truncated`, and `redacted`
- `verification.required_check_ids` and `verification.records[]`
- `provenance.adapter_id`, `provenance.mode`, optional `run_id`
- `policy_profile: local | pre_commit | ci`

Each manifest entry carries `path`, `change`, optional `old_path`, `binary`, `generated`, and server-checked `protected_classes`. The server independently classifies Git paths; the adapter cannot omit a required protected classification.

`risk_signals` is structured and bounded:

```json
{
  "security_sensitive": false,
  "operational_impact": 0.0,
  "compatibility_risk": 0.0,
  "blast_radius": 0.0,
  "reversible": true,
  "scope_drift": false
}
```

Evidence completeness is derived. A complete manifest, available untruncated material sections, required checks that passed against `head`, trusted verification records, and no invalid identity are required. A caller-supplied completeness boolean is not part of the v2 trust decision.

## Trust

`provenance.mode: "trusted_adapter"` is a claim from the adapter. It becomes server-trusted only when `provenance.adapter_id` is present in the server's `JEV_MCP_TRUSTED_ADAPTERS` configuration. The default allowlist is empty. A request cannot change this configuration.

## Result v2

A completed v2 review contains:

- `result_schema_version: "2"`, `evaluation_id`, `status`, `tool`, `action`
- subject identity and sanitized digest
- `gate_eligibility.eligible`, mode, and stable `reason_codes`
- typed `limitations`, resolved risk signals, and provenance claim/trust outcome
- model usage, pack/policy versions, and typed assessment

A failed evaluation uses the same envelope family with `status: "failed"`, `action: "escalate"`, `gate_eligibility.eligible: false`, an error code, message, and retryability flag.

## Gate precedence

```text
transport/validation/error -> failed/escalate
incomplete or contradictory evidence -> review or escalate
protected path / security-sensitive / high component risk -> review
untrusted adapter or non-CI profile -> advisory review
specialist tool -> advisory only
jev_review + trusted adapter + complete evidence + model auto + no floors -> eligible candidate
```

Eligibility is a recommendation for a controlled CI wrapper, not permission to merge, deploy, or execute. v0.3 provides shadow evaluation only; blocking rollout requires conformance, calibration, auditability, and explicit human-approved deployment policy.
