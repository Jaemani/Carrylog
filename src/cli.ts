#!/usr/bin/env node

import { createRequire } from "node:module";
import type { ParseArgsOptionsConfig } from "node:util";
import { parseArgs } from "node:util";
import { refreshHandoff } from "./commands/handoff.js";
import { initProject } from "./commands/init.js";
import { migrateProject } from "./commands/migrate.js";
import { createResumeEnvelope } from "./commands/resume.js";
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
import { escapeTerminalField, escapeTerminalText, stringifyTerminalSafeJson } from "./core/text.js";
import type { Diagnostic, HarnessType } from "./domain/types.js";
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
      case "checkpoint":
        return await runHandoff(commandArguments, "checkpoint");
      case "resume":
        return await runResume(commandArguments);
      case "migrate":
        return await runMigrate(commandArguments);
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

async function runMigrate(argv: string[]): Promise<number> {
  const values = parseCommandArgs(argv, {
    root: { type: "string", short: "r" },
    to: { type: "string" },
    universal: { type: "boolean", default: false },
    adopt: { type: "boolean", default: false },
    check: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  });
  if (values["help"] === true) {
    process.stdout.write(`${migrateHelpText()}\n`);
    return EXIT_SUCCESS;
  }
  const target = stringValue(values["to"]);
  if (target !== "2") {
    throw new CarrylogError("E_MIGRATION_TARGET", "Migration target must be '--to 2'.", {
      exitCode: EXIT_USAGE,
    });
  }
  const project = await loadProject(stringValue(values["root"]) ?? process.cwd());
  const result = await migrateProject(project, {
    to: 2,
    universal: values["universal"] === true,
    adopt: values["adopt"] === true,
    check: values["check"] === true,
    dryRun: values["dry-run"] === true,
  });
  printChanges(result.changes, result.wrote ? "migrated" : "checked");
  return values["check"] === true && result.drift ? EXIT_ISSUES : EXIT_SUCCESS;
}

async function runHandoff(
  argv: string[],
  commandName: "handoff" | "checkpoint" = "handoff",
): Promise<number> {
  const values = parseCommandArgs(argv, {
    root: { type: "string", short: "r" },
    refresh: { type: "boolean", default: false },
    check: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  });
  if (values["help"] === true) {
    process.stdout.write(`${handoffHelpText(commandName)}\n`);
    return EXIT_SUCCESS;
  }
  const project = await loadProject(stringValue(values["root"]) ?? process.cwd());
  const result = await refreshHandoff(project, {
    check: values["check"] === true,
    dryRun: values["dry-run"] === true,
  });
  if (values["json"] === true) {
    process.stdout.write(`${stringifyTerminalSafeJson(result, 2)}\n`);
  } else {
    const symbol = result.kind === "update" ? "~" : "=";
    process.stdout.write(`${symbol} ${escapeTerminalField(result.path)} (${result.kind})\n`);
    process.stdout.write(
      `${result.wrote ? "refreshed" : "checked"}: ${result.snapshot.changes.length + result.snapshot.omittedChanges} changed path(s), ${result.snapshot.recentCommits.length} recent commit(s).\n`,
    );
  }
  return values["check"] === true && result.drift ? EXIT_ISSUES : EXIT_SUCCESS;
}

async function runResume(argv: string[]): Promise<number> {
  const values = parseCommandArgs(argv, {
    root: { type: "string", short: "r" },
    check: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  });
  if (values["help"] === true) {
    process.stdout.write(`${resumeHelpText()}\n`);
    return EXIT_SUCCESS;
  }
  const project = await loadProject(stringValue(values["root"]) ?? process.cwd());
  const envelope = await createResumeEnvelope(project);
  if (values["json"] === true) {
    process.stdout.write(`${stringifyTerminalSafeJson(envelope, 2)}\n`);
  } else {
    process.stdout.write(`Project: ${escapeTerminalField(envelope.project.name)}\n`);
    process.stdout.write(
      `Objective: ${escapeTerminalField(envelope.checkpoint.sections.Objective)}\n`,
    );
    process.stdout.write(
      `Next action: ${escapeTerminalField(envelope.checkpoint.sections["Next action"])}\n`,
    );
    process.stdout.write(`Checkpoint: ${envelope.checkpoint.stale ? "stale" : "ready"}\n`);
  }
  return values["check"] === true && envelope.checkpoint.stale ? EXIT_ISSUES : EXIT_SUCCESS;
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
    adapters: parseAdapters(stringValue(values["adapters"]) ?? "codex,claude,cursor,gemini"),
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
    process.stdout.write(`${stringifyTerminalSafeJson(result, 2)}\n`);
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

function parseAdapters(value: string): HarnessType[] {
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
    if (
      adapter !== "codex" &&
      adapter !== "claude" &&
      adapter !== "cursor" &&
      adapter !== "gemini"
    ) {
      throw new CarrylogError(
        "E_ADAPTER_ARGUMENT",
        `Unsupported adapter '${adapter}'. Supported values: codex, claude, cursor, gemini.`,
        { exitCode: EXIT_USAGE },
      );
    }
  }
  return adapters as HarnessType[];
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
    process.stdout.write(`${symbol} ${escapeTerminalField(change.path)} (${change.kind})\n`);
  }
  const changed = changes.filter((change) => change.kind !== "unchanged").length;
  process.stdout.write(`${action}: ${changed} change(s), ${changes.length - changed} unchanged.\n`);
}

function reportError(error: unknown, json: boolean): number {
  if (error instanceof CarrylogError) {
    if (json) {
      process.stderr.write(
        `${stringifyTerminalSafeJson({ ok: false, code: error.code, diagnostics: error.diagnostics }, 2)}\n`,
      );
    } else {
      process.stderr.write(`${error.diagnostics.map(formatDiagnostic).join("\n")}\n`);
    }
    return error.exitCode;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    process.stderr.write(
      `${stringifyTerminalSafeJson({
        ok: false,
        code: "E_INTERNAL",
        diagnostics: [{ level: "error", code: "E_INTERNAL", message }],
      })}\n`,
    );
  } else {
    process.stderr.write(`[error] E_INTERNAL: ${escapeTerminalText(message)}\n`);
    if (isDebugEnabled(process.env) && error instanceof Error) {
      process.stderr.write(`${escapeTerminalText(error.stack ?? "")}\n`);
    }
  }
  return EXIT_INTERNAL;
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  const location = diagnostic.path === undefined ? "" : ` (${escapeTerminalText(diagnostic.path)})`;
  const hint =
    diagnostic.hint === undefined ? "" : `\n  hint: ${escapeTerminalText(diagnostic.hint)}`;
  return `[${diagnostic.level}] ${diagnostic.code}${location}: ${escapeTerminalText(diagnostic.message)}${hint}`;
}

function helpText(): string {
  return `${PRODUCT_NAME} ${packageJson.version}

Usage: ${CLI_NAME} <command> [options]

Commands:
  init       Create a canonical context layer and managed agent adapters
  sync       Apply safe context migrations and update generated artifacts
  validate   Check schema, ownership, context safety, handoff, and adapter drift
  handoff    Refresh deterministic Git evidence in the handoff document
  checkpoint Validate the portable checkpoint and refresh its Git evidence
  resume     Read and verify a deterministic cross-agent resume envelope
  migrate    Explicitly migrate a reviewed configuration to a newer version

Run '${CLI_NAME} <command> --help' for command-specific options.`;
}

function initHelpText(): string {
  return `Usage: ${CLI_NAME} init [options]

Options:
  -r, --root <path>       Project root (default: current directory)
  -n, --name <name>       Project name (default: root directory name)
      --adapters <list>   Comma-separated harnesses: codex,claude,cursor,gemini
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

function handoffHelpText(commandName: "handoff" | "checkpoint" = "handoff"): string {
  return `Usage: ${CLI_NAME} ${commandName} [--refresh] [options]

Options:
  -r, --root <path>   Project root (default: current directory)
      --refresh       Explicit alias for the default refresh behavior
      --check         Exit 1 when repository evidence would change
      --dry-run       Inspect and render without writing the handoff
      --json          Emit the result and evidence as JSON
  -h, --help          Show this help`;
}

function resumeHelpText(): string {
  return `Usage: ${CLI_NAME} resume [options]

Options:
  -r, --root <path>   Project root (default: current directory)
      --check         Exit 1 when checkpoint Git evidence is stale
      --json          Emit the deterministic portable resume envelope
  -h, --help          Show this help`;
}

function migrateHelpText(): string {
  return `Usage: ${CLI_NAME} migrate --to 2 [options]

Options:
  -r, --root <path>   Project root (default: current directory)
      --to <version>  Required migration target; currently 2
      --universal     Ensure agents (Codex/Cursor), Claude, and Gemini surfaces and Skills
      --adopt         Adopt reviewed existing adapter files; never merges skills
      --check         Exit 1 when migration is required
      --dry-run       Show the complete migration plan without writing
  -h, --help          Show this help`;
}

process.exitCode = await main(process.argv.slice(2));
