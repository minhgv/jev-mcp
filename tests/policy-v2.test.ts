import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateGateV2 } from "../src/policy-v2.ts";
import { validateContextV2 } from "../src/contracts.ts";

const context = {
  context_schema_version: "2",
  repository: "github.com/example/repo",
  comparison: "baseline_to_head",
  request: "Change auth",
  diff: "auth diff",
  baseline: "abc",
  head: "def",
  subject_digest: `sha256:${"b".repeat(64)}`,
  manifest: { complete: true, files: [{ path: "src/auth/reset.ts", change: "modified", protected_classes: ["auth"] }] },
  sections: [
    { id: "request", kind: "request", available: true, truncated: false, redacted: false },
    { id: "diff", kind: "diff", available: true, truncated: false, redacted: false },
  ],
  requirements: [],
  verification: {
    required_check_ids: ["unit"],
    records: [{ check_id: "unit", kind: "test", status: "passed", subject: { revision: "def" }, trusted: true }],
  },
  provenance: { adapter_id: "jev-mcp-ci", mode: "trusted_adapter" },
  policy_profile: "ci",
};

test("only canonical review can be gate eligible", () => {
  const parsed = validateContextV2(context);
  const result = evaluateGateV2({ tool: "jev_assess_change_risk", modelAction: "auto", context: parsed, trustedAdapterIds: ["jev-mcp-ci"] });
  assert.equal(result.gate_eligibility.eligible, false);
  assert.ok(result.reason_codes.includes("specialist_tool_not_gate_capable"));
});

test("protected path creates a deterministic human-review floor", () => {
  const parsed = validateContextV2(context);
  const result = evaluateGateV2({ tool: "jev_review", modelAction: "auto", context: parsed, trustedAdapterIds: ["jev-mcp-ci"] });
  assert.equal(result.action, "review");
  assert.equal(result.gate_eligibility.eligible, false);
  assert.ok(result.reason_codes.includes("protected_path"));
});

test("untrusted provenance cannot become a CI pass", () => {
  const parsed = validateContextV2({ ...context, manifest: { complete: true, files: [{ path: "src/ui.ts", change: "modified", protected_classes: [] }] }, provenance: { adapter_id: "unknown", mode: "host_asserted" } });
  const result = evaluateGateV2({ tool: "jev_review", modelAction: "auto", context: parsed, trustedAdapterIds: ["jev-mcp-ci"] });
  assert.equal(result.gate_eligibility.eligible, false);
  assert.ok(result.reason_codes.includes("untrusted_provenance"));
});

test("component risk signals create deterministic review floors", () => {
  const parsed = validateContextV2({
    ...context,
    manifest: { complete: true, files: [{ path: "src/ui.ts", change: "modified", protected_classes: [] }] },
    risk_signals: { operational_impact: 0.9, compatibility_risk: 0.8, blast_radius: 0.7, reversible: false, scope_drift: true, security_sensitive: true },
  });
  const result = evaluateGateV2({ tool: "jev_review", modelAction: "auto", context: parsed, trustedAdapterIds: ["jev-mcp-ci"] });
  assert.equal(result.action, "review");
  assert.equal(result.gate_eligibility.eligible, false);
  assert.ok(result.reason_codes.includes("operational_impact_high"));
  assert.ok(result.reason_codes.includes("compatibility_risk_high"));
  assert.ok(result.reason_codes.includes("change_not_reversible"));
  assert.ok(result.reason_codes.includes("security_sensitive_change"));
});

test("model review/escalate cannot be promoted by deterministic policy", () => {
  const parsed = validateContextV2({ ...context, manifest: { complete: true, files: [{ path: "src/ui.ts", change: "modified", protected_classes: [] }] } });
  const review = evaluateGateV2({ tool: "jev_review", modelAction: "review", context: parsed, trustedAdapterIds: ["jev-mcp-ci"] });
  const escalate = evaluateGateV2({ tool: "jev_review", modelAction: "escalate", context: parsed, trustedAdapterIds: ["jev-mcp-ci"] });
  assert.equal(review.gate_eligibility.eligible, false);
  assert.equal(escalate.gate_eligibility.eligible, false);
  assert.ok(review.reason_codes.includes("model_action_not_auto"));
});
