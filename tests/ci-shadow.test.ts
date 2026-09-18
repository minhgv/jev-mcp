import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

test("ci-shadow is advisory and emits a machine-readable result", () => {
  const cwd = mkdtempSync(join(tmpdir(), "jev-mcp-shadow-"));
  writeFileSync(join(cwd, "README.md"), "initial\n");
  git(cwd, ["init", "-q"]);
  git(cwd, ["config", "user.email", "test@example.invalid"]);
  git(cwd, ["config", "user.name", "Test"]);
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "initial"]);
  writeFileSync(join(cwd, "README.md"), "changed\n");

  const output = execFileSync(
    process.execPath,
    [
      "--import",
      join(process.cwd(), "node_modules/tsx/dist/loader.mjs"),
      join(process.cwd(), "src/index.ts"),
      "ci-shadow",
      "--request",
      "Review README",
    ],
    {
      cwd,
      encoding: "utf8",
      env: { ...process.env, JEV_MCP_MOCK: "1", TYPESAFE_API_KEY: "" },
    },
  );
  const parsed = JSON.parse(output) as {
    shadow: boolean;
    would_block: boolean;
    evaluation: { result_schema_version?: string };
  };
  assert.equal(parsed.shadow, true);
  assert.equal(parsed.would_block, true);
  assert.ok(parsed.evaluation.result_schema_version === "2");
});
