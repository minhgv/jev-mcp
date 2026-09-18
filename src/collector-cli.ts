import type { PolicyProfile } from "./collector.js";
import { collectGitContext } from "./collector.js";

export async function runContext(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const request = args.request ?? "Review the current working-tree change";
  const context = collectGitContext(process.cwd(), request, {
    baseline: args.base,
    adapterId: args.adapterId ?? "jev-mcp-cli",
    policyProfile: (args.profile ?? "local") as PolicyProfile,
  });
  process.stdout.write(`${JSON.stringify(context, null, 2)}\n`);
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
