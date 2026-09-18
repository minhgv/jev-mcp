import assert from "node:assert/strict";
import { test } from "node:test";
import { asChoice, asNoul, asScore } from "../src/result.ts";

test("runtime validators reject malformed Jev answers", () => {
  assert.throws(() => asNoul({ type: "noul", noul: 2 }), /Invalid Jev noul/);
  assert.throws(() => asChoice({ type: "choice", choice: "other", probabilities: {}, confidence: 0.9 }, ["safe"]), /Unknown Jev choice/);
  assert.throws(() => asScore({ type: "score", score: Number.NaN, legend: {}, probabilities: {}, confidence: 0.5 }), /Invalid Jev score/);
});

test("runtime validators accept well-formed typed answers", () => {
  assert.equal(asNoul({ type: "noul", noul: 0.5 }).noul, 0.5);
  assert.equal(asChoice({ type: "choice", choice: "safe", probabilities: { safe: 1 }, confidence: 1 }, ["safe"]).choice, "safe");
  assert.equal(asScore({ type: "score", score: 1, legend: { "0": "low" }, probabilities: { "0": 1 }, confidence: 1 }).score, 1);
});
