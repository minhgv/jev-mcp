import { z } from "zod";

export const CONTEXT_SCHEMA_VERSION = "1" as const;

export const changeContextSchema = z.object({
  request: z.string().min(1),
  diff: z.string().min(1),
  changed_files: z.array(z.string().min(1)).default([]),
  repository_context: z.string().optional(),
  tests: z.string().optional(),
  deployment_context: z.string().optional(),
  evidence_complete: z.boolean().default(true),
  truncated: z.boolean().default(false),
  redacted: z.boolean().default(false),
});

export type ChangeContext = z.infer<typeof changeContextSchema>;

export function evidenceLimitations(context: Pick<ChangeContext, "evidence_complete" | "truncated" | "redacted">): string[] {
  const limitations: string[] = [];
  if (!context.evidence_complete) limitations.push("host_marked_evidence_incomplete");
  if (context.truncated) limitations.push("context_truncated_before_evaluation");
  if (context.redacted) limitations.push("some_context_was_redacted");
  return limitations;
}
