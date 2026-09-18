import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { evaluateGateV2 } from "../src/policy-v2.ts";
import { validateContextV2 } from "../src/contracts.ts";

for (const [name, expected] of [["valid", true], ["incomplete", false], ["protected", false]] as const) {
  test(`conformance fixture: ${name}`, () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "fixtures/conformance", `${name}.json`), "utf8"));
    const context = validateContextV2(raw);
    const result = evaluateGateV2({
      tool: "jev_review",
      modelAction: "auto",
      context,
      trustedAdapterIds: ["conformance-adapter"],
    });
    assert.equal(result.gate_eligibility.eligible, expected);
    if (!expected) assert.ok(result.gate_eligibility.reason_codes.length > 0);
  });
}
