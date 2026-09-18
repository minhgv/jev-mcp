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
    records: [
      {
        check_id: "unit",
        kind: "test" as const,
        status: "passed" as const,
        subject: { revision: "def456" },
        trusted: true,
      },
    ],
  },
};

test("collector redacts credentials before building context", () => {
  const redacted = redactText(snapshot.diff);
  assert.equal(redacted.includes("ts_super_secret_value_should_not_escape"), false);
  assert.ok(redacted.includes("[REDACTED]"));
});

test("redactText covers common secret shapes", () => {
  const cases: Array<[string, string]> = [
    ["aws access key", "aws_access_key_id = AKIAIOSFODNN7EXAMPLE"],
    ["jwt", "token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PLf"],
    ["authorization header", "Authorization: Bearer abcdef1234567890XYZ"],
    ["bare bearer", "curl -H 'Bearer abcdef1234567890XYZ'"],
    ["pem block", "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA7\n-----END RSA PRIVATE KEY-----"],
    ["slack token", "SLACK=xoxb-123456789012-abcdefghijkl"],
    ["openai-style key", "OPENAI_API_KEY=sk-abcdefghijklmnop1234567890"],
    ["github pat", "GITHUB_TOKEN=ghp_abcdefghijklmnop1234"],
    ["client secret", "client_secret: z9y8x7w6v5u4"],
  ];
  for (const [name, input] of cases) {
    const redacted = redactText(input);
    assert.ok(redacted.includes("[REDACTED]"), `${name} was not redacted: ${redacted}`);
    assert.equal(redacted.includes("AKIAIOSFODNN7EXAMPLE"), false);
    assert.equal(redacted.includes("abcdef1234567890XYZ"), false);
    assert.equal(redacted.includes("MIIEpAIBAAKCAQEA7"), false);
  }
});

test("redactText leaves ordinary code untouched", () => {
  const code = "const retryCount = 3;\nfunction authenticate(user) { return user.id; }";
  assert.equal(redactText(code), code);
});

test("collector emits stable v2 context and digest", () => {
  const first = buildChangeContext(snapshot, { adapterId: "jev-mcp-ci", policyProfile: "ci" });
  const second = buildChangeContext(snapshot, { adapterId: "jev-mcp-ci", policyProfile: "ci" });
  assert.equal(first.context_schema_version, "2");
  assert.match(first.subject_digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.subject_digest, second.subject_digest);
  assert.equal(first.manifest.complete, true);
  assert.equal(
    first.sections.some((section) => section.redacted),
    true,
  );
});

test("collector marks incomplete manifests instead of inventing completeness", () => {
  const context = buildChangeContext({ ...snapshot, files: [] }, { adapterId: "jev-mcp-ci", policyProfile: "ci" });
  assert.equal(context.manifest.complete, false);
  assert.ok(context.manifest.omission_reasons.includes("empty_file_manifest"));
});
