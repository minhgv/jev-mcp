import { z } from "zod";
import { CONTEXT_SCHEMA_VERSION, evidenceLimitations } from "../context.js";
import { getConfig } from "../config.js";
import { requirementQuestions, REQUIREMENT_STATUSES } from "../packs/requirement.js";
import { asChoice } from "../result.js";
import { minConfidence, requirementAction } from "../policy.js";
import { systemOne } from "../typesafe.js";
import { assertThresholdOrder } from "../validation.js";

const requirementInput = z.object({ id: z.string().min(1).max(200), text: z.string().min(1).max(20_000) });

export const requirementInputSchema = z.object({
  requirements: z.array(requirementInput).min(1).max(100).superRefine((requirements, ctx) => {
    const ids = requirements.map((requirement) => requirement.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "requirement ids must be unique" });
  }),
  diff: z.string().min(1).max(200_000),
  tests: z.string().optional(),
  repository_context: z.string().optional(),
  evidence_complete: z.boolean().default(true),
  truncated: z.boolean().default(false),
  redacted: z.boolean().default(false),
  auto_accept: z.number().min(0).max(1).optional(),
  review_at: z.number().min(0).max(1).optional(),
  model: z.string().optional(),
});

export type RequirementInput = z.infer<typeof requirementInputSchema>;

export async function runCheckRequirement(input: RequirementInput) {
  const config = getConfig();
  const autoAccept = input.auto_accept ?? config.autoAccept;
  const reviewAt = input.review_at ?? config.reviewAt;
  assertThresholdOrder({ autoAccept, reviewAt });
  const result = await systemOne({
    state: {
      requirements: input.requirements,
      diff: input.diff,
      tests: input.tests ?? "",
      repository_context: input.repository_context ?? "",
      evidence_complete: input.evidence_complete,
      truncated: input.truncated,
      redacted: input.redacted,
    },
    questions: requirementQuestions(input.requirements),
    model: input.model,
  });

  const requirements = input.requirements.map((requirement, index) => {
    const answer = asChoice(result.answers[`requirement_${index}`], ["covered", "partial", "not_covered", "not_verifiable"]);
    const status = answer.choice as (typeof REQUIREMENT_STATUSES)[number];
    return {
      id: requirement.id,
      text: requirement.text,
      status,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      evidence: input.tests ? ["diff", "tests"] : ["diff"],
    };
  });
  const confidence = minConfidence(requirements.map((item) => item.confidence));
  const limitations = evidenceLimitations(input);
  if (!input.tests) limitations.push("no_verification_output_supplied");
  const action = requirementAction({
    statuses: requirements.map((item) => item.status),
    minConfidence: confidence,
    evidenceComplete: input.evidence_complete && !input.truncated && !result.truncated && Boolean(input.tests),
    autoAccept,
    reviewAt,
  });

  return {
    schema_version: "1",
    tool: "jev_check_requirement",
    context_schema_version: CONTEXT_SCHEMA_VERSION,
    pack: { id: "requirement", version: "1" },
    policy: { id: "requirement-v1", version: "1" },
    model: result.model,
    usage: result.usage,
    truncated: result.truncated || input.truncated,
    action,
    requirements,
    missing_evidence: limitations,
    limitations,
    thresholds: { auto_accept: autoAccept, review_at: reviewAt },
  };
}
