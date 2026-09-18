import { z } from "zod";
import { type ProtectedClass, protectedClassesForPath, validateGitPath } from "./path-policy.js";

export const CONTEXT_SCHEMA_VERSION_V2 = "2" as const;
export const RESULT_SCHEMA_VERSION_V2 = "2" as const;

export const verificationStatuses = [
  "passed",
  "failed",
  "skipped",
  "not_run",
  "running",
  "cancelled",
  "timed_out",
  "error",
  "unknown",
] as const;

const protectedClassSchema = z.enum([
  "auth",
  "security",
  "billing",
  "database",
  "migration",
  "permission",
  "network",
  "deployment",
  "secrets",
]);

const fileEntrySchema = z.object({
  path: z.string().min(1).max(4096),
  change: z.enum(["added", "modified", "deleted", "renamed", "copied", "type_changed"]),
  old_path: z.string().min(1).max(4096).optional(),
  binary: z.boolean().default(false),
  generated: z.boolean().default(false),
  protected_classes: z.array(protectedClassSchema).max(9).default([]),
});

const sectionSchema = z.object({
  id: z.string().min(1).max(128),
  kind: z.enum(["request", "diff", "tests", "requirements", "repository", "other"]),
  content: z.string().max(200_000).optional(),
  available: z.boolean().default(true),
  truncated: z.boolean().default(false),
  redacted: z.boolean().default(false),
});

const requirementSchema = z.object({
  id: z.string().min(1).max(128),
  text: z.string().min(1).max(10_000),
});

const verificationRecordSchema = z.object({
  check_id: z.string().min(1).max(128),
  kind: z.enum(["test", "typecheck", "lint", "build", "security_scan", "other"]),
  executor: z.string().min(1).max(256).default("unknown"),
  invocation: z.string().max(10_000).optional(),
  status: z.enum(verificationStatuses),
  subject: z.object({ revision: z.string().min(1).max(512) }),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  result_summary: z.string().max(20_000).optional(),
  evidence_ref: z.string().max(2_000).optional(),
  trusted: z.boolean().default(false),
});

const riskSignalsSchema = z.object({
  security_sensitive: z.boolean().default(false),
  operational_impact: z.number().min(0).max(1).default(0),
  compatibility_risk: z.number().min(0).max(1).default(0),
  blast_radius: z.number().min(0).max(1).default(0),
  reversible: z.boolean().default(true),
  scope_drift: z.boolean().default(false),
});

export const changeContextV2Schema = z.object({
  context_schema_version: z.literal(CONTEXT_SCHEMA_VERSION_V2),
  repository: z.string().min(1).max(512),
  comparison: z.enum(["baseline_to_head", "working_tree", "merge_candidate"]),
  request: z.string().min(1).max(50_000),
  diff: z.string().min(1).max(300_000),
  baseline: z.string().max(512).optional(),
  head: z.string().max(512).optional(),
  subject_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  manifest: z.object({
    complete: z.boolean(),
    files: z.array(fileEntrySchema).max(1_000),
    omission_reasons: z.array(z.string().max(256)).max(32).default([]),
  }),
  sections: z.array(sectionSchema).max(32),
  requirements: z.array(requirementSchema).max(100).default([]),
  risk_signals: riskSignalsSchema.default({
    security_sensitive: false,
    operational_impact: 0,
    compatibility_risk: 0,
    blast_radius: 0,
    reversible: true,
    scope_drift: false,
  }),
  verification: z.object({
    required_check_ids: z.array(z.string().min(1).max(128)).max(100),
    records: z.array(verificationRecordSchema).max(100),
  }),
  provenance: z.object({
    adapter_id: z.string().min(1).max(256),
    mode: z.enum(["host_asserted", "trusted_adapter"]),
    run_id: z.string().max(512).optional(),
  }),
  policy_profile: z.enum(["local", "pre_commit", "ci"]),
});

export type ChangeContextV2 = z.infer<typeof changeContextV2Schema>;
export type ProtectedClassV2 = ProtectedClass;

export function validateContextV2(input: unknown): ChangeContextV2 {
  const parsed = changeContextV2Schema.parse(input);
  const allFiles = parsed.manifest.files.flatMap((file) => [file.path, ...(file.old_path ? [file.old_path] : [])]);
  for (const path of allFiles) {
    validateGitPath(path);
    const actual = new Set(protectedClassesForPath(path));
    const fileEntry = parsed.manifest.files.find((file) => file.path === path || file.old_path === path);
    const declared = new Set(fileEntry?.protected_classes ?? []);
    for (const classification of actual) {
      if (!declared.has(classification)) {
        throw new Error(`Protected path classification mismatch for ${path}`);
      }
    }
  }
  return parsed;
}

export type EvidenceState = {
  complete: boolean;
  reason_codes: string[];
  protected_classes: ProtectedClass[];
};

export function deriveEvidenceState(context: ChangeContextV2): EvidenceState {
  const reasons = new Set<string>();
  if (!context.manifest.complete) reasons.add("manifest_incomplete");
  if (context.manifest.files.length === 0) reasons.add("file_manifest_empty");
  if (context.verification.required_check_ids.length === 0) reasons.add("required_checks_not_declared");

  for (const section of context.sections) {
    if (!section.available) reasons.add("required_section_unavailable");
    if (section.truncated) reasons.add("material_context_truncated");
    if (section.redacted && (section.kind === "diff" || section.kind === "tests" || section.kind === "requirements")) {
      reasons.add("material_context_redacted");
    }
  }

  const records = new Map(context.verification.records.map((record) => [record.check_id, record]));
  for (const checkId of context.verification.required_check_ids) {
    const record = records.get(checkId);
    if (!record) {
      reasons.add("required_check_missing");
      continue;
    }
    if (record.status !== "passed") reasons.add("required_check_not_passed");
    if (context.head && record.subject.revision !== context.head) reasons.add("verification_subject_mismatch");
    if (!record.trusted) reasons.add("untrusted_verification");
  }

  const protectedClasses = context.manifest.files.flatMap((file) => file.protected_classes);
  return {
    complete: reasons.size === 0,
    reason_codes: [...reasons],
    protected_classes: [...new Set(protectedClasses)],
  };
}
