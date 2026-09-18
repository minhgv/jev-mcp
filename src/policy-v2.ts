import { deriveEvidenceState, type ChangeContextV2 } from "./contracts.js";

export type GateAction = "auto" | "review" | "escalate";

export type GateResult = {
  action: GateAction;
  gate_eligibility: {
    eligible: boolean;
    mode: ChangeContextV2["policy_profile"];
    reason_codes: string[];
  };
  reason_codes: string[];
  evidence: ReturnType<typeof deriveEvidenceState>;
};

export function evaluateGateV2(input: {
  tool: string;
  modelAction: GateAction;
  context: ChangeContextV2;
  trustedAdapterIds: string[];
}): GateResult {
  const evidence = deriveEvidenceState(input.context);
  const reasons = new Set(evidence.reason_codes);
  if (input.tool !== "jev_review") reasons.add("specialist_tool_not_gate_capable");
  if (input.context.provenance.mode !== "trusted_adapter" || !input.trustedAdapterIds.includes(input.context.provenance.adapter_id)) {
    reasons.add("untrusted_provenance");
  }
  if (evidence.protected_classes.length > 0) reasons.add("protected_path");
  const risk = input.context.risk_signals;
  if (risk.security_sensitive) reasons.add("security_sensitive_change");
  if (risk.operational_impact >= 0.67) reasons.add("operational_impact_high");
  if (risk.compatibility_risk >= 0.67) reasons.add("compatibility_risk_high");
  if (risk.blast_radius >= 0.67) reasons.add("blast_radius_high");
  if (!risk.reversible) reasons.add("change_not_reversible");
  if (risk.scope_drift) reasons.add("scope_drift");
  if (input.modelAction !== "auto") reasons.add("model_action_not_auto");
  if (input.context.policy_profile !== "ci") reasons.add("advisory_policy_profile");

  const reasonCodes = [...reasons];
  const hasEscalation = input.modelAction === "escalate"
    || reasonCodes.some((reason) => ["required_check_not_passed", "verification_subject_mismatch", "invalid_model_output"].includes(reason));
  const action: GateAction = hasEscalation ? "escalate" : reasonCodes.length > 0 ? "review" : "auto";
  const eligible = action === "auto" && input.context.policy_profile === "ci" && input.tool === "jev_review";
  return {
    action,
    gate_eligibility: { eligible, mode: input.context.policy_profile, reason_codes: reasonCodes },
    reason_codes: reasonCodes,
    evidence,
  };
}
