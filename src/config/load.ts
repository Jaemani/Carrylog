import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parseDocument } from "yaml";
import { CarrylogError, issueError } from "../core/errors.js";
import { readTextIfExists } from "../core/files.js";
import { assertNoSymlink, canonicalProjectRoot, resolveProjectPath } from "../core/paths.js";
import { CONFIG_PATH, type LoadedProject, type ProjectConfig } from "../domain/types.js";
import { CLI_NAME } from "../product.js";
import { decodeConfig } from "./decode.js";

const MAX_CONFIG_BYTES = 1024 * 1024;

export async function loadProject(rootInput: string): Promise<LoadedProject> {
  const { root, source } = await findProjectRoot(rootInput);
  const configPath = resolveProjectPath(root, CONFIG_PATH);
  const config = parseConfigSource(source);
  return deepFreeze({ root, configPath, configSource: source, config });
}

export function parseConfigSource(source: string): ProjectConfig {
  if (Buffer.byteLength(source, "utf8") > MAX_CONFIG_BYTES) {
    throw issueError("E_FILE_TOO_LARGE", "Configuration source exceeds the 1 MiB safety limit.");
  }
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
    throw new CarrylogError("E_CONFIG_YAML", "Configuration contains invalid YAML.", {
      diagnostics,
    });
  }

  let raw: unknown;
  try {
    raw = document.toJS({ maxAliasCount: 100 });
  } catch (error) {
    throw new CarrylogError("E_CONFIG_YAML", "Configuration could not be expanded safely.", {
      cause: error,
    });
  }

  const decoded = decodeConfig(raw);
  if (decoded.config === undefined) {
    throw new CarrylogError("E_CONFIG_INVALID", "Configuration is invalid.", {
      diagnostics: decoded.diagnostics,
    });
  }

  return decoded.config;
}

export async function assertLoadedProjectSnapshot(project: LoadedProject): Promise<void> {
  const expectedConfigPath = resolveProjectPath(project.root, CONFIG_PATH);
  if (path.resolve(project.configPath) !== expectedConfigPath) {
    throw issueError(
      "E_PROJECT_SNAPSHOT",
      "Loaded project configuration path does not match its project root.",
    );
  }
  const sourceConfig = parseConfigSource(project.configSource);
  if (!isDeepStrictEqual(sourceConfig, project.config)) {
    throw issueError(
      "E_PROJECT_SNAPSHOT",
      "Loaded project configuration was mutated after parsing.",
      "Reload the project before calling a command.",
    );
  }

  let currentSource: string | undefined;
  try {
    await assertNoSymlink(project.root, expectedConfigPath);
    currentSource = await readTextIfExists(expectedConfigPath, { maxBytes: MAX_CONFIG_BYTES });
  } catch {
    throw concurrentConfigChange();
  }
  if (currentSource !== project.configSource) {
    throw concurrentConfigChange();
  }
}

function concurrentConfigChange(): CarrylogError {
  return issueError(
    "E_CONCURRENT_MODIFICATION",
    `Configuration changed after it was loaded: ${CONFIG_PATH}`,
    "Reload the project and rerun the command.",
  );
}

async function findProjectRoot(startInput: string): Promise<{ root: string; source: string }> {
  const start = await canonicalProjectRoot(startInput);
  let current = start;
  while (true) {
    const candidate = resolveProjectPath(current, CONFIG_PATH);
    await assertNoSymlink(current, candidate);
    const source = await readTextIfExists(candidate, { maxBytes: MAX_CONFIG_BYTES });
    if (source !== undefined) {
      return { root: current, source };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw issueError(
        "E_CONFIG_MISSING",
        `No ${CONFIG_PATH} found from ${start} to the filesystem root.`,
        `Run '${CLI_NAME} init' from the project root.`,
      );
    }
    current = parent;
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
