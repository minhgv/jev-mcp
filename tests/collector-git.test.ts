import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { collectGitContext } from "../src/collector.ts";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

test("git collector includes working-tree and untracked files", () => {
  const cwd = mkdtempSync(join(tmpdir(), "jev-mcp-git-"));
  mkdirSync(join(cwd, "src"));
  writeFileSync(join(cwd, "src/app.ts"), "export const app = 1;\n");
  git(cwd, ["init", "-q"]);
  git(cwd, ["config", "user.email", "test@example.invalid"]);
  git(cwd, ["config", "user.name", "Test"]);
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "initial"]);
  writeFileSync(join(cwd, "src/app.ts"), "export const app = 2;\n");
  writeFileSync(join(cwd, ".env.local"), "TYPESAFE_API_KEY=ts_super_secret_value_should_not_escape\n");

  const context = collectGitContext(cwd, "Update app safely", {
    adapterId: "jev-mcp-ci",
    policyProfile: "ci",
  });
  const paths = context.manifest.files.map((file) => file.path);
  assert.ok(paths.includes("src/app.ts"));
  assert.ok(paths.includes(".env.local"));
  assert.equal(context.manifest.complete, true);
  assert.equal(context.diff.includes("ts_super_secret_value_should_not_escape"), false);
  assert.ok(context.manifest.files.find((file) => file.path === ".env.local")?.protected_classes.includes("secrets"));
  assert.equal(context.comparison, "working_tree");
});
