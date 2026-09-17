import type { Questions } from "@typesafe-ai/sdk";

export const REQUIREMENT_STATUSES = ["covered", "partial", "not_covered", "not_verifiable"] as const;

export type RequirementRef = { id: string; text: string };

export function requirementQuestions(requirements: RequirementRef[]): Questions {
  return Object.fromEntries(
    requirements.map((requirement, index) => [
      `requirement_${index}`,
      {
        type: "choice",
        instructions: `Is requirement ${requirement.id} addressed by the supplied implementation and evidence? Requirement: ${requirement.text}`,
        criteria: {
          covered: "The implementation and verification evidence directly support the complete requirement",
          partial: "Some of the requirement is addressed, but an important part or evidence is missing",
          not_covered: "The implementation does not address the requirement or contradicts it",
          not_verifiable: "The supplied context is insufficient to determine whether it is addressed",
        },
      },
    ]),
  );
}
