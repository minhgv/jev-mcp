import { codingLoopQuestions } from "./coding-loop.js";
import { changeRiskQuestions } from "./change-risk.js";
import { issueQuestions } from "./issue.js";
import { rankQuestions } from "./rank.js";
import { requirementQuestions } from "./requirement.js";
import { reviewQuestions } from "./review.js";
import { screenQuestions } from "./screen.js";
import { VERIFY_CRITERIA, verifyQuestions } from "./verify.js";

export const PACK_IDS = ["coding-loop", "review", "verify", "screen", "rank", "change-risk", "requirement", "issue"] as const;
export type PackId = (typeof PACK_IDS)[number];

export function packBody(id: PackId): unknown {
  switch (id) {
    case "coding-loop":
      return codingLoopQuestions();
    case "review":
      return reviewQuestions();
    case "verify":
      return {
        note: "One Choice per claim. IDs are claim_0, claim_1, …",
        criteria: VERIFY_CRITERIA,
        example: verifyQuestions(1),
      };
    case "screen":
      return screenQuestions(true);
    case "rank":
      return {
        note: "Choice over candidate ids (max 250 per call) plus an exists Noul. Candidate texts are truncated to 2000 characters.",
        example: rankQuestions("how do I rotate API keys", [
          { id: "auth", text: "To rotate an API key: create a new key, switch the app, revoke the old key." },
          { id: "billing", text: "Invoices are issued monthly." },
        ]),
      };
    case "change-risk":
      return changeRiskQuestions();
    case "requirement":
      return {
        note: "One Choice per requirement; runtime IDs are requirement_0, requirement_1, …",
        example: requirementQuestions([{ id: "R1", text: "The change satisfies the acceptance criterion" }]),
      };
    case "issue":
      return {
        note: "Issue classification uses constrained owner candidates supplied by the host.",
        example: issueQuestions(["platform", "unknown"]),
      };
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

export function packUri(id: PackId): string {
  return `jev://packs/${id}`;
}
