import { z } from "zod";
import { CONTEXT_SCHEMA_VERSION, evidenceLimitations } from "../context.js";
import { getConfig } from "../config.js";
import { issueQuestions } from "../packs/issue.js";
import { asChoice, asNoul } from "../result.js";
import { actionFromConfidence, minConfidence, noulConfidence } from "../policy.js";
import { systemOne } from "../typesafe.js";

export const classifyIssueInputSchema = z.object({
  issue: z.string().min(1),
  repository_context: z.string().optional(),
  owner_candidates: z.array(z.string().min(1)).min(2),
  evidence: z.string().optional(),
  evidence_complete: z.boolean().default(true),
  truncated: z.boolean().default(false),
  model: z.string().optional(),
});

export type ClassifyIssueInput = z.infer<typeof classifyIssueInputSchema>;

export async function runClassifyIssue(input: ClassifyIssueInput) {
  const config = getConfig();
  const owners = [...new Set(input.owner_candidates)];
  if (!owners.includes("unknown")) owners.push("unknown");
  const result = await systemOne({
    state: {
      issue: input.issue,
      repository_context: input.repository_context ?? "",
      owner_candidates: owners,
      evidence: input.evidence ?? "",
      evidence_complete: input.evidence_complete,
      truncated: input.truncated,
    },
    questions: issueQuestions(owners),
    model: input.model,
  });
  const category = asChoice(result.answers.category);
  const severity = asChoice(result.answers.severity);
  const urgency = asChoice(result.answers.urgency);
  const owner = asChoice(result.answers.owner);
  const reproduction = asNoul(result.answers.needs_reproduction);
  const confidence = minConfidence([category.confidence, severity.confidence, urgency.confidence, owner.confidence, noulConfidence(reproduction.noul)]);
  const evidenceComplete = input.evidence_complete && !input.truncated && !result.truncated && Boolean(input.evidence);
  const action = evidenceComplete
    ? actionFromConfidence(confidence, config.autoAccept, config.reviewAt)
    : "review";
  const limitations = evidenceLimitations({
    evidence_complete: input.evidence_complete,
    truncated: input.truncated || result.truncated,
    redacted: false,
  });
  if (!input.evidence) limitations.push("no_issue_evidence_supplied");

  return {
    schema_version: "1",
    tool: "jev_classify_issue",
    context_schema_version: CONTEXT_SCHEMA_VERSION,
    pack: { id: "issue", version: "1" },
    policy: { id: "issue-v1", version: "1" },
    model: result.model,
    usage: result.usage,
    truncated: result.truncated || input.truncated,
    action,
    classification: {
      category: category.choice,
      severity: severity.choice,
      urgency: urgency.choice,
      owner: owners.includes(owner.choice) ? owner.choice : "unknown",
      owner_candidates: owners,
      needs_reproduction: reproduction.noul,
      confidence,
    },
    missing_evidence: limitations,
    limitations,
  };
}
