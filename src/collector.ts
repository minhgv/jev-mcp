import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { type ChangeContextV2, CONTEXT_SCHEMA_VERSION_V2, validateContextV2 } from "./contracts.js";
import { type ProtectedClass, protectedClassesForPath } from "./path-policy.js";

export type CollectorFile = {
  path: string;
  change: "added" | "modified" | "deleted" | "renamed" | "copied" | "type_changed";
  old_path?: string;
  binary?: boolean;
  generated?: boolean;
};

export type CollectorSnapshot = {
  repository: string;
  baseline?: string;
  head?: string;
  request?: string;
  diff: string;
  files: CollectorFile[];
  tests?: string;
  requirements?: Array<{ id: string; text: string }>;
  risk_signals?: ChangeContextV2["risk_signals"];
  verification: ChangeContextV2["verification"];
};

export type PolicyProfile = ChangeContextV2["policy_profile"];

export type CollectorOptions = {
  adapterId: string;
  policyProfile: ChangeContextV2["policy_profile"];
  comparison?: ChangeContextV2["comparison"];
  manifestComplete?: boolean;
  runId?: string;
};

export function redactText(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED]")
    .replace(/\b(authorization\s*[:=]\s*)(?:basic|bearer|token)\s+[^\s"'`]+/gi, "$1[REDACTED]")
    .replace(/\bbearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, "Bearer [REDACTED]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, "[REDACTED]")
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, "[REDACTED]")
    .replace(/\b(?:sk|pk|rk|key)-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]")
    .replace(/\b(?:ts|gh[pousr]?|sk)_[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
    .replace(
      /(\b(?:token|api[_-]?key|password|passwd|secret|credential|client[_-]?secret|private[_-]?key|access[_-]?key)\b\s*[:=]\s*)([^\s"'`]+)/gi,
      "$1[REDACTED]",
    );
}

export function buildChangeContext(snapshot: CollectorSnapshot, options: CollectorOptions): ChangeContextV2 {
  const redactedDiff = redactText(snapshot.diff);
  const redactedTests = snapshot.tests === undefined ? undefined : redactText(snapshot.tests);
  const files = snapshot.files.map((file) => ({
    ...file,
    binary: file.binary ?? false,
    generated: file.generated ?? false,
    protected_classes: uniqueClasses([file.path, ...(file.old_path ? [file.old_path] : [])]),
  }));
  const omissionReasons = files.length === 0 && options.manifestComplete === undefined ? ["empty_file_manifest"] : [];
  if (options.manifestComplete === false) omissionReasons.push("adapter_marked_manifest_incomplete");
  const manifestComplete = options.manifestComplete ?? files.length > 0;
  const contextWithoutDigest = {
    context_schema_version: CONTEXT_SCHEMA_VERSION_V2,
    repository: snapshot.repository,
    comparison: options.comparison ?? "baseline_to_head",
    request: snapshot.request ?? "Unspecified change request",
    diff: redactedDiff,
    baseline: snapshot.baseline,
    head: snapshot.head,
    manifest: { complete: manifestComplete, files, omission_reasons: omissionReasons },
    sections: [
      {
        id: "request",
        kind: "request" as const,
        content: snapshot.request ?? "Unspecified change request",
        available: true,
        truncated: false,
        redacted: false,
      },
      {
        id: "diff",
        kind: "diff" as const,
        content: redactedDiff,
        available: true,
        truncated: false,
        redacted: redactedDiff !== snapshot.diff,
      },
      ...(redactedTests === undefined
        ? []
        : [
            {
              id: "tests",
              kind: "tests" as const,
              content: redactedTests,
              available: true,
              truncated: false,
              redacted: redactedTests !== snapshot.tests,
            },
          ]),
    ],
    requirements: snapshot.requirements ?? [],
    risk_signals: snapshot.risk_signals ?? {},
    verification: snapshot.verification,
    provenance: { adapter_id: options.adapterId, mode: "trusted_adapter" as const, run_id: options.runId },
    policy_profile: options.policyProfile,
  };
  const digest = `sha256:${createHash("sha256").update(canonicalJson(contextWithoutDigest)).digest("hex")}`;
  return validateContextV2({ ...contextWithoutDigest, subject_digest: digest });
}

function uniqueClasses(paths: string[]): ProtectedClass[] {
  return [...new Set(paths.flatMap((path) => protectedClassesForPath(path)))];
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export type GitCollectorOptions = Omit<CollectorOptions, "comparison"> & {
  baseline?: string;
};

export function collectGitContext(cwd: string, request: string, options: GitCollectorOptions): ChangeContextV2 {
  const head = runGit(cwd, ["rev-parse", "HEAD"]);
  const baseline = options.baseline ?? head;
  const repository = remoteRepository(cwd);
  const status = runGit(cwd, ["status", "--porcelain=v1"]);
  const files = parseStatus(runGit(cwd, ["diff", "--name-status", baseline]), status);
  const untracked = files.filter((file) => file.change === "added" && status.includes(`?? ${file.path}`));
  const untrackedContent = untracked
    .map((file) => {
      const buffer = readFileSync(`${cwd}/${file.path}`);
      if (buffer.includes(0)) return `\n# Untracked binary file: ${file.path}\n`;
      return `\n# Untracked file: ${file.path}\n${buffer.toString("utf8").slice(0, 200_000)}\n`;
    })
    .join("");
  const diff = `${runGit(cwd, ["diff", "--binary", baseline])}${untrackedContent}`;
  return buildChangeContext(
    {
      repository,
      baseline,
      head,
      request,
      diff: diff || "No changes collected.",
      files,
      verification: { required_check_ids: [], records: [] },
    },
    { ...options, comparison: "working_tree", manifestComplete: true },
  );
}

function remoteRepository(cwd: string): string {
  try {
    return runGit(cwd, ["remote", "get-url", "origin"]);
  } catch {
    return cwd;
  }
}

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 2_000_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Git collector failed: git ${args.join(" ")}: ${message}`);
  }
}

function parseStatus(nameStatus: string, porcelain: string): CollectorFile[] {
  const files: CollectorFile[] = [];
  for (const line of nameStatus.split("\n").filter(Boolean)) {
    const parts = line.split("\t");
    const code = parts[0] ?? "M";
    const status = code[0];
    const path = parts[parts.length - 1] ?? "";
    const oldPath = parts.length > 2 ? parts[1] : undefined;
    files.push({ path, old_path: oldPath, change: mapChange(status), binary: false, generated: false });
  }
  for (const line of porcelain.split("\n").filter((item) => item.startsWith("?? "))) {
    const path = line.slice(3).trim();
    if (!files.some((file) => file.path === path))
      files.push({ path, change: "added", binary: false, generated: false });
  }
  return files;
}

function mapChange(status: string): CollectorFile["change"] {
  if (status === "A") return "added";
  if (status === "D") return "deleted";
  if (status === "R") return "renamed";
  if (status === "C") return "copied";
  if (status === "T") return "type_changed";
  return "modified";
}
