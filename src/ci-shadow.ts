import { collectGitContext } from "./collector.js";
import { errorMessage } from "./errors.js";
import { errorResultV2 } from "./result.js";
import { runReviewV2 } from "./tools/review.js";

export async function runCiShadow(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  try {
    const context = collectGitContext(process.cwd(), args.request ?? "Review the current CI candidate", {
      baseline: args.base,
      adapterId: args.adapter_id ?? "jev-mcp-ci",
      policyProfile: "ci",
      runId: args.run_id,
    });
    const evaluation = await runReviewV2({ context, model: args.model });
    process.stdout.write(
      `${JSON.stringify({ shadow: true, would_block: evaluation.action !== "auto" || !(evaluation.gate_eligibility as { eligible: boolean }).eligible, evaluation }, null, 2)}\n`,
    );
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify(
        {
          shadow: true,
          would_block: true,
          evaluation: errorResultV2({ code: "JEV_SHADOW_ERROR", message: errorMessage(error), retryable: false }),
        },
        null,
        2,
      )}\n`,
    );
  }
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value?.startsWith("--")) continue;
    const key = value.slice(2).replaceAll("-", "_");
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = "true";
    }
  }
  return result;
}
