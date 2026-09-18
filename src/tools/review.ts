import { z } from "zod";
import { getConfig } from "../config.js";
import { CONTEXT_SCHEMA_VERSION, evidenceLimitations } from "../context.js";
import { type ChangeContextV2, changeContextV2Schema, validateContextV2 } from "../contracts.js";
import { reviewQuestions } from "../packs/review.js";
import { minConfidence, reviewAction, reviewComposite } from "../policy.js";
import { evaluateGateV2 } from "../policy-v2.js";
import { asNoul, asScore, resultV2 } from "../result.js";
import { systemOne } from "../typesafe.js";
import { assertThresholdOrder } from "../validation.js";

const legacyReviewInputSchema = z
  .object({
    request: z.string().min(1).max(20_000).describe("What the user asked for"),
    diff: z.string().min(1).max(200_000).describe("Proposed patch, file excerpt, or change summary"),
    tests: z.string().max(100_000).optional().describe("Test output if any"),
    changed_files: z.array(z.string().min(1).max(500)).max(1_000).default([]),
    repository_context: z.string().max(100_000).optional(),
    evidence_complete: z.boolean().default(true),
    context_version: z.string().default(CONTEXT_SCHEMA_VERSION),
    truncated: z.boolean().default(false),
    auto_accept: z.number().min(0).max(1).optional(),
    review_at: z.number().min(0).max(1).optional(),
    model: z.string().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.auto_accept !== undefined && input.review_at !== undefined && input.review_at > input.auto_accept) {
      ctx.addIssue({ code: "custom", message: "review_at must be <= auto_accept", path: ["review_at"] });
    }
  });

export const reviewV2InputSchema = z.object({
  context: changeContextV2Schema,
  model: z.string().optional(),
});

export const reviewInputSchema = z.union([legacyReviewInputSchema, reviewV2InputSchema]);

export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type ReviewV2Input = z.infer<typeof reviewV2InputSchema>;

export async function runReview(input: ReviewInput) {
  if ("context" in input) {
    return runReviewV2(input);
  }
  const config = getConfig();
  const autoAccept = input.auto_accept ?? config.autoAccept;
  const reviewAt = input.review_at ?? config.reviewAt;
  assertThresholdOrder({ autoAccept, reviewAt });
  const result = await systemOne({
    state: {
      request: input.request,
      diff: input.diff,
      tests: input.tests ?? "",
      changed_files: input.changed_files,
      repository_context: input.repository_context ?? "",
      evidence_complete: input.evidence_complete,
      context_version: input.context_version,
      truncated: input.truncated,
    },
    questions: reviewQuestions(),
    model: input.model,
  });
  const correctness = asScore(result.answers.correctness);
  const specMatch = asScore(result.answers.spec_match);
  const testGap = asScore(result.answers.test_gap);
  const blastRadius = asScore(result.answers.blast_radius);
  const safeToApply = asNoul(result.answers.safe_to_apply);
  const composite = reviewComposite({
    correctness: correctness.score,
    specMatch: specMatch.score,
    testGap: testGap.score,
    blastRadius: blastRadius.score,
  });
  const action =
    input.evidence_complete && !input.truncated && !result.truncated
      ? reviewAction({
          composite,
          safeToApply: safeToApply.noul,
          minConfidence: minConfidence([
            correctness.confidence,
            specMatch.confidence,
            testGap.confidence,
            blastRadius.confidence,
          ]),
          autoAccept,
          reviewAt,
        })
      : ("review" as const);
  const limitations = evidenceLimitations({
    evidence_complete: input.evidence_complete,
    truncated: input.truncated || result.truncated,
    redacted: false,
  });
  return {
    schema_version: "1",
    deprecated_input_schema: "v1",
    tool: "jev_review",
    context_schema_version: input.context_version,
    pack: { id: "review", version: "1" },
    policy: { id: "review-v1", version: "1" },
    model: result.model,
    usage: result.usage,
    truncated: result.truncated || input.truncated,
    action,
    composite,
    safe_to_apply: safeToApply.noul,
    scores: {
      correctness: { score: correctness.score, confidence: correctness.confidence },
      spec_match: { score: specMatch.score, confidence: specMatch.confidence },
      test_gap: { score: testGap.score, confidence: testGap.confidence },
      blast_radius: { score: blastRadius.score, confidence: blastRadius.confidence },
    },
    weights: {
      correctness: 0.4,
      spec_match: 0.3,
      test_gap: 0.15,
      blast_radius: 0.15,
    },
    thresholds: { auto_accept: autoAccept, review_at: reviewAt },
    missing_evidence: limitations,
    limitations,
  };
}

export async function runReviewV2(input: ReviewV2Input) {
  const config = getConfig();
  const context: ChangeContextV2 = validateContextV2(input.context);
  const model = input.model?.trim() || config.model;
  const result = await systemOne({
    state: context,
    questions: reviewQuestions(),
    model,
  });
  const correctness = asScore(result.answers.correctness);
  const specMatch = asScore(result.answers.spec_match);
  const testGap = asScore(result.answers.test_gap);
  const blastRadius = asScore(result.answers.blast_radius);
  const safeToApply = asNoul(result.answers.safe_to_apply);
  const composite = reviewComposite({
    correctness: correctness.score,
    specMatch: specMatch.score,
    testGap: testGap.score,
    blastRadius: blastRadius.score,
  });
  const modelAction = reviewAction({
    composite,
    safeToApply: safeToApply.noul,
    minConfidence: minConfidence([
      correctness.confidence,
      specMatch.confidence,
      testGap.confidence,
      blastRadius.confidence,
    ]),
    autoAccept: config.autoAccept,
    reviewAt: config.reviewAt,
  });
  const gate = evaluateGateV2({
    tool: "jev_review",
    modelAction,
    context,
    trustedAdapterIds: config.trustedAdapterIds,
  });
  return resultV2({
    tool: "jev_review",
    model: result.model,
    usage: result.usage,
    context,
    gate,
    pack: { id: "review", version: "2" },
    policy: { id: "ci-review-v2", version: "2" },
    assessment: {
      composite,
      safe_to_apply: safeToApply.noul,
      scores: {
        correctness: { score: correctness.score, confidence: correctness.confidence },
        spec_match: { score: specMatch.score, confidence: specMatch.confidence },
        test_gap: { score: testGap.score, confidence: testGap.confidence },
        blast_radius: { score: blastRadius.score, confidence: blastRadius.confidence },
      },
    },
  });
}
