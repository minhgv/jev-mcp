import { randomUUID } from "node:crypto";
import type { ChoiceResponse, NoulResponse, ScoreResponse, SystemOneResult } from "@typesafe-ai/sdk";
import { JevValidationError } from "./errors.js";
import type { ChangeContextV2 } from "./contracts.js";
import type { GateResult } from "./policy-v2.js";
import type { PolicyAction } from "./policy.js";

export type JsonRecord = Record<string, unknown>;

export function jsonResult(payload: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

export function jsonError(message: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

export function jsonErrorV2(code: string, message: string, retryable = false): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(errorResultV2({ code, message, retryable }), null, 2) }],
  };
}

export function asNoul(answer: unknown): NoulResponse {
  if (!isRecord(answer) || answer.type !== "noul" || typeof answer.noul !== "number" || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) {
    throw new JevValidationError("Invalid Jev noul response");
  }
  return answer as unknown as NoulResponse;
}

export function asChoice(answer: unknown, allowed?: readonly string[]): ChoiceResponse {
  if (!isRecord(answer) || answer.type !== "choice" || typeof answer.choice !== "string" || !isRecord(answer.probabilities) || typeof answer.confidence !== "number" || !Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) {
    throw new JevValidationError("Invalid Jev choice response");
  }
  if (allowed && !allowed.includes(answer.choice)) {
    throw new JevValidationError(`Unknown Jev choice: ${answer.choice}`);
  }
  for (const probability of Object.values(answer.probabilities)) {
    if (typeof probability !== "number" || !Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new JevValidationError("Invalid Jev choice probability");
    }
  }
  return answer as unknown as ChoiceResponse;
}

export function asScore(answer: unknown): ScoreResponse {
  if (!isRecord(answer) || answer.type !== "score" || typeof answer.score !== "number" || !Number.isFinite(answer.score) || !isRecord(answer.legend) || !isRecord(answer.probabilities) || typeof answer.confidence !== "number" || !Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) {
    throw new JevValidationError("Invalid Jev score response");
  }
  for (const probability of Object.values(answer.probabilities)) {
    if (typeof probability !== "number" || !Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new JevValidationError("Invalid Jev score probability");
    }
  }
  return answer as unknown as ScoreResponse;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function usageOf(result: SystemOneResult<Record<string, never>> | { usage: { input_tokens: number; output_tokens: number } }): {
  input_tokens: number;
  output_tokens: number;
} {
  return result.usage;
}

export type ToolEnvelope = {
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  truncated: boolean;
  action: PolicyAction;
};

export type ResultV2Input = {
  tool: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  context: ChangeContextV2;
  gate: GateResult;
  pack: { id: string; version: string };
  policy: { id: string; version: string };
  assessment: unknown;
};

export function resultV2(input: ResultV2Input): Record<string, unknown> {
  return {
    result_schema_version: "2",
    status: "completed",
    evaluation_id: randomUUID(),
    tool: input.tool,
    action: input.gate.action,
    model: { requested: input.model, resolved: input.model },
    usage: input.usage,
    subject: {
      repository: input.context.repository,
      comparison: input.context.comparison,
      baseline: input.context.baseline,
      head: input.context.head,
      digest: input.context.subject_digest,
    },
    gate_eligibility: input.gate.gate_eligibility,
    risk_signals: input.context.risk_signals,
    reason_codes: input.gate.reason_codes,
    limitations: input.gate.reason_codes.map((code) => ({ code, impact: "blocks_auto" })),
    provenance: {
      adapter_id: input.context.provenance.adapter_id,
      claimed_mode: input.context.provenance.mode,
      server_gate_eligible: input.gate.gate_eligibility.eligible,
    },
    pack: input.pack,
    policy: input.policy,
    assessment: input.assessment,
  };
}

export function errorResultV2(input: {
  code: string;
  message: string;
  retryable: boolean;
}): Record<string, unknown> {
  return {
    result_schema_version: "2",
    status: "failed",
    evaluation_id: randomUUID(),
    action: "escalate",
    gate_eligibility: { eligible: false, mode: "ci", reason_codes: [input.code] },
    reason_codes: [input.code],
    error: { code: input.code, message: input.message, retryable: input.retryable },
  };
}
