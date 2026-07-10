import path from "node:path";
import { parseDocument } from "yaml";
import { AckitError, issueError } from "../core/errors.js";
import { readTextIfExists } from "../core/files.js";
import { assertNoSymlink, canonicalProjectRoot, resolveProjectPath } from "../core/paths.js";
import { CONFIG_PATH, type LoadedProject } from "../domain/types.js";
import { decodeConfig } from "./decode.js";

export async function loadProject(rootInput: string): Promise<LoadedProject> {
  const { root, source } = await findProjectRoot(rootInput);
  const configPath = resolveProjectPath(root, CONFIG_PATH);

  const document = parseDocument(source, {
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    const diagnostics = document.errors.map((error) => ({
      level: "error" as const,
      code: "E_CONFIG_YAML",
      message: error.message,
      path: CONFIG_PATH,
    }));
    throw new AckitError("E_CONFIG_YAML", "Configuration contains invalid YAML.", {
      diagnostics,
    });
  }

  let raw: unknown;
  try {
    raw = document.toJS({ maxAliasCount: 100 });
  } catch (error) {
    throw new AckitError("E_CONFIG_YAML", "Configuration could not be expanded safely.", {
      cause: error,
    });
  }

  const decoded = decodeConfig(raw);
  if (decoded.config === undefined) {
    throw new AckitError("E_CONFIG_INVALID", "Configuration is invalid.", {
      diagnostics: decoded.diagnostics,
    });
  }

  return { root, configPath, config: decoded.config };
}

async function findProjectRoot(startInput: string): Promise<{ root: string; source: string }> {
  const start = await canonicalProjectRoot(startInput);
  let current = start;
  while (true) {
    const candidate = resolveProjectPath(current, CONFIG_PATH);
    await assertNoSymlink(current, candidate);
    const source = await readTextIfExists(candidate, { maxBytes: 1024 * 1024 });
    if (source !== undefined) {
      return { root: current, source };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw issueError(
        "E_CONFIG_MISSING",
        `No ${CONFIG_PATH} found from ${start} to the filesystem root.`,
        "Run 'ackit init' from the project root.",
      );
    }
    current = parent;
  }
}
