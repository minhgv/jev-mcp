import type { Questions } from "@typesafe-ai/sdk";

export const CHANGE_RISK_LEVELS = ["low", "medium", "high"] as const;

export function changeRiskQuestions(): Questions {
  return {
    risk_level: {
      type: "choice",
      instructions: "What is the overall risk of making or releasing this change?",
      criteria: {
        low: "Localized, reversible, well-tested, and not production-sensitive",
        medium: "Affects shared behavior or several modules but remains controlled",
        high: "Affects authentication, authorization, billing, data integrity, deployment, or production behavior",
      },
    },
    security_sensitive: {
      type: "noul",
      instructions: "Does this change touch security-sensitive behavior or boundaries?",
      criteria: {
        true: "Touches authentication, authorization, secrets, network boundaries, or sensitive data",
        false: "Does not affect security-sensitive behavior",
      },
    },
    operational_impact: {
      type: "score",
      instructions: "How large could the operational impact be if this change fails?",
      criteria: [
        "Contained local impact with an easy rollback",
        "Affects a shared service or requires coordinated recovery",
        "Can cause production outage, data loss, or difficult recovery",
      ] as const,
    },
    compatibility_risk: {
      type: "score",
      instructions: "How likely is this change to break compatibility or data contracts?",
      criteria: [
        "No meaningful compatibility or data-contract risk",
        "Some callers, schemas, or integrations may require checking",
        "Breakage of public APIs, schemas, migrations, or clients is plausible",
      ] as const,
    },
    reversible: {
      type: "noul",
      instructions: "Is the change straightforward to roll back or disable?",
      criteria: {
        true: "A safe rollback, feature flag, or reversible migration exists",
        false: "Rollback is difficult, destructive, or not established",
      },
    },
    scope_drift: {
      type: "noul",
      instructions: "Does the proposed change expand beyond the stated request?",
      criteria: {
        true: "Includes unrelated behavior, cleanup, or architecture changes",
        false: "Stays within the requested scope",
      },
    },
    needs_human_review: {
      type: "noul",
      instructions: "Does this change require human or specialist review before release?",
      criteria: {
        true: "Sensitive, high-impact, ambiguous, or insufficiently evidenced",
        false: "Low-risk and sufficiently evidenced for automated handling",
      },
    },
  };
}
