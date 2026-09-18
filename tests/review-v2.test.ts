import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { runReviewV2 } from "../src/tools/review.ts";
import { errorResultV2 } from "../src/result.ts";

const previousMock = process.env.JEV_MCP_MOCK;

before(() => {
  process.env.JEV_MCP_MOCK = "1";
});

after(() => {
  if (previousMock === undefined) delete process.env.JEV_MCP_MOCK;
  else process.env.JEV_MCP_MOCK = previousMock;
});

const context = {
  context_schema_version: "2" as const,
  repository: "github.com/example/repo",
  comparison: "baseline_to_head" as const,
  request: "Add a safe UI label",
  diff: "diff --git a/src/ui.ts b/src/ui.ts\n+export const label = 'safe';",
  baseline: "abc123",
  head: "def456",
  subject_digest: `sha256:${"c".repeat(64)}`,
  manifest: { complete: true, files: [{ path: "src/ui.ts", change: "modified" as const, protected_classes: [] as const[] }], omission_reasons: [] },
  sections: [
    { id: "request", kind: "request" as const, available: true, truncated: false, redacted: false },
    { id: "diff", kind: "diff" as const, available: true, truncated: false, redacted: false },
  ],
  requirements: [],
  verification: {
    required_check_ids: ["unit"],
    records: [{ check_id: "unit", kind: "test" as const, status: "passed" as const, subject: { revision: "def456" }, trusted: true }],
  },
  provenance: { adapter_id: "jev-mcp-ci", mode: "trusted_adapter" as const },
  policy_profile: "ci" as const,
};

test("review v2 returns a versioned non-eligible result for model review", async () => {
  const result = await runReviewV2({ context, model: "jev-latest" });
  assert.equal(result.result_schema_version, "2");
  assert.equal(result.tool, "jev_review");
  assert.equal(result.gate_eligibility.eligible, false);
  assert.ok(["auto", "review", "escalate"].includes(result.action));
  assert.ok(result.assessment);
});

test("v2 error envelope is always non-passing and machine-readable", () => {
  const error = errorResultV2({ code: "UNSUPPORTED_CONTEXT_VERSION", message: "unsupported", retryable: false });
  assert.equal(error.result_schema_version, "2");
  assert.equal(error.status, "failed");
  assert.equal(error.gate_eligibility.eligible, false);
  assert.equal(error.error.code, "UNSUPPORTED_CONTEXT_VERSION");
});
