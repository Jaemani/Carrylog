#!/usr/bin/env node

import { createRequire } from "node:module";
import type { ParseArgsOptionsConfig } from "node:util";
import { parseArgs } from "node:util";
import { refreshHandoff } from "./commands/handoff.js";
import { initProject } from "./commands/init.js";
import { syncProject } from "./commands/sync.js";
import { validateProject } from "./commands/validate.js";
import { loadProject } from "./config/load.js";
import {
  CarrylogError,
  EXIT_INTERNAL,
  EXIT_ISSUES,
  EXIT_SUCCESS,
  EXIT_USAGE,
} from "./core/errors.js";
import type { AdapterType, Diagnostic } from "./domain/types.js";
import { CLI_NAME, isDebugEnabled, PRODUCT_NAME } from "./product.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

export async function main(argv: string[]): Promise<number> {
  const jsonOutput = argv.includes("--json");
  try {
    if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
      process.stdout.write(`${helpText()}\n`);
      return EXIT_SUCCESS;
    }
    if (argv[0] === "--version" || argv[0] === "-v") {
      process.stdout.write(`${packageJson.version}\n`);
      return EXIT_SUCCESS;
    }

    const command = argv[0];
    const commandArguments = argv.slice(1);
    switch (command) {
      case "init":
        return await runInit(commandArguments);
      case "sync":
        return await runSync(commandArguments);
      case "validate":
        return await runValidate(commandArguments);
      case "handoff":
        return await runHandoff(commandArguments);
      case "help":
        process.stdout.write(`${helpText()}\n`);
        return EXIT_SUCCESS;
      default:
        throw new CarrylogError("E_UNKNOWN_COMMAND", `Unknown command: ${command}`, {
          exitCode: EXIT_USAGE,
        });
    }
  } catch (error) {
    return reportError(error, jsonOutput);
  }
}

async function runHandoff(argv: string[]): Promise<number> {
  const values = parseCommandArgs(argv, {
    root: { type: "string", short: "r" },
    refresh: { type: "boolean", default: false },
    check: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  });
  if (values["help"] === true) {
    process.stdout.write(`${handoffHelpText()}\n`);
    return EXIT_SUCCESS;
  }
  const project = await loadProject(stringValue(values["root"]) ?? process.cwd());
  const result = await refreshHandoff(project, {
    check: values["check"] === true,
    dryRun: values["dry-run"] === true,
  });
  if (values["json"] === true) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const symbol = result.kind === "update" ? "~" : "=";
    process.stdout.write(`${symbol} ${result.path} (${result.kind})\n`);
    process.stdout.write(
      `${result.wrote ? "refreshed" : "checked"}: ${result.snapshot.changes.length + result.snapshot.omittedChanges} changed path(s), ${result.snapshot.recentCommits.length} recent commit(s).\n`,
    );
  }
  return values["check"] === true && result.drift ? EXIT_ISSUES : EXIT_SUCCESS;
}

async function runInit(argv: string[]): Promise<number> {
  const values = parseCommandArgs(argv, {
    root: { type: "string", short: "r" },
    name: { type: "string", short: "n" },
    adapters: { type: "string" },
    adopt: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  });
  if (values["help"] === true) {
    process.stdout.write(`${initHelpText()}\n`);
    return EXIT_SUCCESS;
  }
  const root = stringValue(values["root"]) ?? process.cwd();
  const name = stringValue(values["name"]);
  const options = {
    root,
    adapters: parseAdapters(stringValue(values["adapters"]) ?? "codex,claude"),
    adopt: values["adopt"] === true,
    dryRun: values["dry-run"] === true,
  };
  const result = await initProject(name === undefined ? options : { ...options, name });
  printChanges(result.changes, options.dryRun ? "planned" : "initialized");
  return EXIT_SUCCESS;
}

async function runSync(argv: string[]): Promise<number> {
  const values = parseCommandArgs(argv, {
    root: { type: "string", short: "r" },
    adopt: { type: "boolean", default: false },
    check: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  });
  if (values["help"] === true) {
    process.stdout.write(`${syncHelpText()}\n`);
    return EXIT_SUCCESS;
  }
  const project = await loadProject(stringValue(values["root"]) ?? process.cwd());
  const result = await syncProject(project, {
    adopt: values["adopt"] === true,
    check: values["check"] === true,
    dryRun: values["dry-run"] === true,
  });
  if (result.diagnostics.length > 0) {
    process.stderr.write(`${result.diagnostics.map(formatDiagnostic).join("\n")}\n`);
  }
  printChanges(result.changes, result.wrote ? "synchronized" : "checked");
  return values["check"] === true && result.drift ? EXIT_ISSUES : EXIT_SUCCESS;
}

async function runValidate(argv: string[]): Promise<number> {
  const values = parseCommandArgs(argv, {
    root: { type: "string", short: "r" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  });
  if (values["help"] === true) {
    process.stdout.write(`${validateHelpText()}\n`);
    return EXIT_SUCCESS;
  }
  const project = await loadProject(stringValue(values["root"]) ?? process.cwd());
  const result = await validateProject(project);
  if (values["json"] === true) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.diagnostics.length === 0) {
    process.stdout.write("Context and adapters are valid.\n");
  } else {
    process.stdout.write(`${result.diagnostics.map(formatDiagnostic).join("\n")}\n`);
  }
  return result.valid ? EXIT_SUCCESS : EXIT_ISSUES;
}

function parseCommandArgs(
  argv: string[],
  options: ParseArgsOptionsConfig,
): Record<string, string | boolean | (string | boolean)[] | undefined> {
  try {
    const parsed = parseArgs({ args: argv, options, strict: true, allowPositionals: false });
    return parsed.values;
  } catch (error) {
    throw new CarrylogError(
      "E_ARGUMENTS",
      error instanceof Error ? error.message : "Invalid command arguments.",
      { exitCode: EXIT_USAGE, cause: error },
    );
  }
}

function parseAdapters(value: string): AdapterType[] {
  const adapters = [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  if (adapters.length === 0) {
    throw new CarrylogError("E_ADAPTER_ARGUMENT", "At least one adapter is required.", {
      exitCode: EXIT_USAGE,
    });
  }
  for (const adapter of adapters) {
    if (adapter !== "codex" && adapter !== "claude") {
      throw new CarrylogError(
        "E_ADAPTER_ARGUMENT",
        `Unsupported adapter '${adapter}'. Supported values: codex, claude.`,
        { exitCode: EXIT_USAGE },
      );
    }
  }
  return adapters as AdapterType[];
}

function stringValue(
  value: string | boolean | (string | boolean)[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function printChanges(
  changes: { path: string; kind: "create" | "update" | "unchanged" }[],
  action: string,
): void {
  for (const change of changes) {
    const symbol = change.kind === "create" ? "+" : change.kind === "update" ? "~" : "=";
    process.stdout.write(`${symbol} ${change.path} (${change.kind})\n`);
  }
  const changed = changes.filter((change) => change.kind !== "unchanged").length;
  process.stdout.write(`${action}: ${changed} change(s), ${changes.length - changed} unchanged.\n`);
}

function reportError(error: unknown, json: boolean): number {
  if (error instanceof CarrylogError) {
    if (json) {
      process.stderr.write(
        `${JSON.stringify({ ok: false, code: error.code, diagnostics: error.diagnostics }, null, 2)}\n`,
      );
    } else {
      process.stderr.write(`${error.diagnostics.map(formatDiagnostic).join("\n")}\n`);
    }
    return error.exitCode;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code: "E_INTERNAL",
        diagnostics: [{ level: "error", code: "E_INTERNAL", message }],
      })}\n`,
    );
  } else {
    process.stderr.write(`[error] E_INTERNAL: ${message}\n`);
    if (isDebugEnabled(process.env) && error instanceof Error) {
      process.stderr.write(`${error.stack ?? ""}\n`);
    }
  }
  return EXIT_INTERNAL;
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  const location = diagnostic.path === undefined ? "" : ` (${diagnostic.path})`;
  const hint = diagnostic.hint === undefined ? "" : `\n  hint: ${diagnostic.hint}`;
  return `[${diagnostic.level}] ${diagnostic.code}${location}: ${diagnostic.message}${hint}`;
}

function helpText(): string {
  return `${PRODUCT_NAME} ${packageJson.version}

Usage: ${CLI_NAME} <command> [options]

Commands:
  init       Create a canonical context layer and managed agent adapters
  sync       Apply safe context migrations and update generated artifacts
  validate   Check schema, ownership, context safety, handoff, and adapter drift
  handoff    Refresh deterministic Git evidence in the handoff document

Run '${CLI_NAME} <command> --help' for command-specific options.`;
}

function initHelpText(): string {
  return `Usage: ${CLI_NAME} init [options]

Options:
  -r, --root <path>       Project root (default: current directory)
  -n, --name <name>       Project name (default: root directory name)
      --adapters <list>   Comma-separated adapters: codex,claude
      --adopt             Append managed blocks to reviewed existing adapter files
      --dry-run           Show the complete write plan without changing files
  -h, --help              Show this help`;
}

function syncHelpText(): string {
  return `Usage: ${CLI_NAME} sync [options]

Options:
  -r, --root <path>   Project root (default: current directory)
      --adopt         Append managed blocks to reviewed existing adapter files
      --check         Exit 1 when generated artifacts would change
      --dry-run       Show changes without writing them
  -h, --help          Show this help`;
}

function validateHelpText(): string {
  return `Usage: ${CLI_NAME} validate [options]

Options:
  -r, --root <path>   Project root (default: current directory)
      --json          Emit machine-readable diagnostics
  -h, --help          Show this help`;
}

function handoffHelpText(): string {
  return `Usage: ${CLI_NAME} handoff [--refresh] [options]

Options:
  -r, --root <path>   Project root (default: current directory)
      --refresh       Explicit alias for the default refresh behavior
      --check         Exit 1 when repository evidence would change
      --dry-run       Inspect and render without writing the handoff
      --json          Emit the result and evidence as JSON
  -h, --help          Show this help`;
}

process.exitCode = await main(process.argv.slice(2));
