import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONTEXT_SCHEMA_VERSION_V2,
  changeContextV2Schema,
  deriveEvidenceState,
  validateContextV2,
} from "../src/contracts.ts";

const baseContext = {
  context_schema_version: "2",
  repository: "github.com/example/repo",
  comparison: "baseline_to_head",
  request: "Add a bounded reset rate limit",
  diff: "diff --git a/src/auth/reset.ts b/src/auth/reset.ts",
  baseline: "abc123",
  head: "def456",
  subject_digest: `sha256:${"a".repeat(64)}`,
  manifest: {
    complete: true,
    files: [{ path: "src/auth/reset.ts", change: "modified", protected_classes: ["auth"] }],
  },
  sections: [
    { id: "request", kind: "request", available: true, truncated: false, redacted: false },
    { id: "diff", kind: "diff", available: true, truncated: false, redacted: false },
  ],
  requirements: [],
  verification: {
    required_check_ids: ["unit"],
    records: [{ check_id: "unit", kind: "test", status: "passed", subject: { revision: "def456" }, trusted: true }],
  },
  provenance: { adapter_id: "jev-mcp-ci", mode: "trusted_adapter" },
  policy_profile: "ci",
};

test("context v2 validates the complete change contract", () => {
  const parsed = validateContextV2(baseContext);
  assert.equal(parsed.context_schema_version, CONTEXT_SCHEMA_VERSION_V2);
  assert.equal(deriveEvidenceState(parsed).complete, true);
});

test("context v2 derives incomplete evidence instead of trusting a boolean", () => {
  const parsed = changeContextV2Schema.parse({
    ...baseContext,
    manifest: { ...baseContext.manifest, complete: false },
    verification: { required_check_ids: ["unit", "integration"], records: baseContext.verification.records },
  });
  const evidence = deriveEvidenceState(parsed);
  assert.equal(evidence.complete, false);
  assert.ok(evidence.reason_codes.includes("manifest_incomplete"));
  assert.ok(evidence.reason_codes.includes("required_check_missing"));
});

test("context v2 rejects unsupported versions and unsafe paths", () => {
  assert.throws(() => validateContextV2({ ...baseContext, context_schema_version: "9" }));
  assert.throws(() => validateContextV2({
    ...baseContext,
    manifest: { complete: true, files: [{ path: "../escape.ts", change: "modified", protected_classes: [] }] },
  }));
});

test("material redaction or truncation is a policy limitation", () => {
  const parsed = validateContextV2({
    ...baseContext,
    sections: [{ id: "diff", kind: "diff", available: true, truncated: true, redacted: false }],
  });
  const evidence = deriveEvidenceState(parsed);
  assert.equal(evidence.complete, false);
  assert.ok(evidence.reason_codes.includes("material_context_truncated"));
});
