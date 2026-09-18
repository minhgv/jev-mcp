#!/usr/bin/env node
import { runDoctor, runEval } from "./cli.js";
import { runContext } from "./collector-cli.js";
import { runCiShadow } from "./ci-shadow.js";
import { runStdio } from "./server.js";
import { errorMessage } from "./errors.js";
import { VERSION } from "./version.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === "doctor") {
    await runDoctor();
    return;
  }
  if (cmd === "context") {
    await runContext(argv.slice(1));
    return;
  }
  if (cmd === "ci-shadow") {
    await runCiShadow(argv.slice(1));
    return;
  }
  if (cmd === "eval") {
    await runEval(argv.slice(1));
    return;
  }
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }
  if (cmd && !cmd.startsWith("-")) {
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exitCode = 1;
    return;
  }
  await runStdio();
}

function printHelp(): void {
  console.error(`jev-mcp ${VERSION} — TypeSafe Jev MCP server

Usage:
  jev-mcp          Start stdio MCP (Cursor, Codex, any MCP client)
  jev-mcp context --request TEXT [--base SHA] [--profile local|pre_commit|ci]
  jev-mcp ci-shadow --request TEXT [--base SHA] [--model MODEL]
  jev-mcp doctor          Check env, API key, and a tiny live/mock ping
  jev-mcp eval --json '{ "state": "...", "questions": { ... } }'
  jev-mcp eval --state TEXT --questions JSON
  jev-mcp eval --stdin
`);
}

main().catch((err) => {
  console.error(errorMessage(err));
  process.exit(1);
});
