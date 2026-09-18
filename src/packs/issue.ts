import type { Questions } from "@typesafe-ai/sdk";

export const ISSUE_CATEGORIES = {
  security: "Authentication, authorization, secrets, abuse, or security controls",
  data_integrity: "Incorrect, duplicated, lost, or inconsistent data",
  reliability: "Outage, crash, timeout, failure recovery, or availability",
  performance: "Latency, throughput, memory, CPU, or resource usage",
  compatibility: "API, schema, client, platform, or deployment compatibility",
  usability: "User-facing behavior, accessibility, or workflow friction",
  maintainability: "Code health, architecture, testability, or documentation",
  other: "Does not fit the available categories",
} as const;

export const ISSUE_SEVERITIES = {
  low: "Limited impact with a practical workaround",
  medium: "Meaningful impact affecting a subset of users or workflows",
  high: "Major impact, broad degradation, or a sensitive subsystem",
  critical: "Data loss, security compromise, payment corruption, or severe outage",
} as const;

export const ISSUE_URGENCY = {
  low: "Can be scheduled normally",
  medium: "Should be handled in the current planning cycle",
  high: "Needs prompt investigation or mitigation",
} as const;

export function issueQuestions(ownerCandidates: string[]): Questions {
  return {
    category: {
      type: "choice",
      instructions: "Which category best describes the issue?",
      criteria: ISSUE_CATEGORIES,
    },
    severity: {
      type: "choice",
      instructions: "How severe is the issue based on the supplied impact evidence?",
      criteria: ISSUE_SEVERITIES,
    },
    urgency: {
      type: "choice",
      instructions: "How urgent is the issue?",
      criteria: ISSUE_URGENCY,
    },
    owner: {
      type: "choice",
      instructions: "Which allowed owner candidate is the best initial routing target?",
      criteria: Object.fromEntries(
        ownerCandidates.map((owner) => [
          owner,
          owner === "unknown" ? "No safe owner inference" : `Allowed owner candidate: ${owner}`,
        ]),
      ),
    },
    needs_reproduction: {
      type: "noul",
      instructions: "Is more reproduction or diagnostic evidence needed before implementation?",
      criteria: {
        true: "The report lacks reliable reproduction or diagnostic evidence",
        false: "The supplied report is sufficiently concrete to begin triage",
      },
    },
  };
}
