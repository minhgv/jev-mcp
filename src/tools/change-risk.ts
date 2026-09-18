import { z } from "zod";
import { getConfig } from "../config.js";
import { CONTEXT_SCHEMA_VERSION, changeContextSchema, evidenceLimitations } from "../context.js";
import { changeRiskQuestions } from "../packs/change-risk.js";
import { changeRiskAction, minConfidence, noulConfidence } from "../policy.js";
import { asChoice, asNoul, asScore } from "../result.js";
import { systemOne } from "../typesafe.js";

export const changeRiskInputSchema = changeContextSchema.extend({
  auto_accept: z.number().min(0).max(1).optional(),
  review_at: z.number().min(0).max(1).optional(),
  model: z.string().optional(),
});

export type ChangeRiskInput = z.infer<typeof changeRiskInputSchema>;

export async function runAssessChangeRisk(input: ChangeRiskInput) {
  const config = getConfig();
  const autoAccept = input.auto_accept ?? config.autoAccept;
  const reviewAt = input.review_at ?? config.reviewAt;
  const result = await systemOne({
    state: {
      request: input.request,
      diff: input.diff,
      changed_files: input.changed_files,
      repository_context: input.repository_context ?? "",
      tests: input.tests ?? "",
      deployment_context: input.deployment_context ?? "",
      evidence_complete: input.evidence_complete,
      truncated: input.truncated,
      redacted: input.redacted,
    },
    questions: changeRiskQuestions(),
    model: input.model,
  });

  const risk = asChoice(result.answers.risk_level, ["low", "medium", "high"]);
  const security = asNoul(result.answers.security_sensitive);
  const operational = asScore(result.answers.operational_impact);
  const compatibility = asScore(result.answers.compatibility_risk);
  const reversible = asNoul(result.answers.reversible);
  const scopeDrift = asNoul(result.answers.scope_drift);
  const humanReview = asNoul(result.answers.needs_human_review);
  const confidence = minConfidence([
    risk.confidence,
    noulConfidence(security.noul),
    operational.confidence,
    compatibility.confidence,
    noulConfidence(reversible.noul),
    noulConfidence(scopeDrift.noul),
    noulConfidence(humanReview.noul),
  ]);
  const evidenceComplete =
    input.evidence_complete &&
    !input.truncated &&
    !result.truncated &&
    Boolean(input.tests) &&
    input.changed_files.length > 0;
  const action = changeRiskAction({
    risk: risk.choice as "low" | "medium" | "high",
    confidence,
    evidenceComplete,
    securitySensitive: security.noul,
    needsHumanReview: humanReview.noul,
    autoAccept,
    reviewAt,
  });
  const limitations = evidenceLimitations(input);
  if (!input.tests) limitations.push("no_verification_output_supplied");
  if (input.changed_files.length === 0) limitations.push("no_changed_file_manifest_supplied");

  return {
    schema_version: "1",
    tool: "jev_assess_change_risk",
    context_schema_version: CONTEXT_SCHEMA_VERSION,
    pack: { id: "change-risk", version: "1" },
    policy: { id: "change-risk-v1", version: "1" },
    model: result.model,
    usage: result.usage,
    truncated: result.truncated || input.truncated,
    action,
    risk: {
      level: risk.choice,
      confidence: risk.confidence,
      security_sensitive: security.noul,
      operational_impact: operational.score,
      compatibility_risk: compatibility.score,
      reversible: reversible.noul,
      scope_drift: scopeDrift.noul,
      needs_human_review: humanReview.noul,
      aggregate_confidence: confidence,
    },
    missing_evidence: limitations,
    limitations,
    thresholds: { auto_accept: autoAccept, review_at: reviewAt },
  };
}
