import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateInputSchema } from "../src/tools/evaluate.ts";
import { requirementInputSchema } from "../src/tools/requirement.ts";
import { reviewInputSchema } from "../src/tools/review.ts";
import { assertThresholdOrder } from "../src/validation.ts";

test("schemas reject unbounded dynamic inputs and duplicate requirement ids", () => {
  const questions = Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`q${index}`, { type: "noul", instructions: "x" }]));
  assert.equal(evaluateInputSchema.safeParse({ state: "x", questions }).success, false);
  assert.equal(requirementInputSchema.safeParse({ requirements: [{ id: "REQ-1", text: "a" }, { id: "REQ-1", text: "b" }], diff: "diff" }).success, false);
});

test("threshold order is fail-closed", () => {
  assert.throws(() => assertThresholdOrder({ autoAccept: 0.5, reviewAt: 0.8 }), /review threshold/);
  assert.equal(reviewInputSchema.safeParse({ request: "r", diff: "d", auto_accept: 0.5, review_at: 0.8 }).success, false);
});
