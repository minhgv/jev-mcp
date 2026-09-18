import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChangeContext, redactText } from "../src/collector.ts";

const snapshot = {
  repository: "github.com/example/repo",
  baseline: "abc123",
  head: "def456",
  diff: "diff --git a/src/app.ts b/src/app.ts\n+const token = ts_super_secret_value_should_not_escape",
  files: [{ path: "src/app.ts", change: "modified" as const }],
  requirements: [{ id: "R1", text: "Keep the endpoint backward compatible" }],
  verification: {
    required_check_ids: ["unit"],
    records: [{ check_id: "unit", kind: "test" as const, status: "passed" as const, subject: { revision: "def456" }, trusted: true }],
  },
};

test("collector redacts credentials before building context", () => {
  const redacted = redactText(snapshot.diff);
  assert.equal(redacted.includes("ts_super_secret_value_should_not_escape"), false);
  assert.ok(redacted.includes("[REDACTED]"));
});

test("collector emits stable v2 context and digest", () => {
  const first = buildChangeContext(snapshot, { adapterId: "jev-mcp-ci", policyProfile: "ci" });
  const second = buildChangeContext(snapshot, { adapterId: "jev-mcp-ci", policyProfile: "ci" });
  assert.equal(first.context_schema_version, "2");
  assert.match(first.subject_digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.subject_digest, second.subject_digest);
  assert.equal(first.manifest.complete, true);
  assert.equal(first.sections.some((section) => section.redacted), true);
});

test("collector marks incomplete manifests instead of inventing completeness", () => {
  const context = buildChangeContext({ ...snapshot, files: [] }, { adapterId: "jev-mcp-ci", policyProfile: "ci" });
  assert.equal(context.manifest.complete, false);
  assert.ok(context.manifest.omission_reasons.includes("empty_file_manifest"));
});
