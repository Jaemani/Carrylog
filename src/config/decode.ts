import { isAdapterType } from "../adapters/registry.js";
import { assertPortableRelativePath, portablePathKey } from "../core/paths.js";
import { hasUnsafeLineControl, isWellFormedUnicode } from "../core/text.js";
import type {
  AdapterConfig,
  AdapterConfigV1,
  AdapterConfigV2,
  AdapterSurfaceType,
  ContextDocument,
  Diagnostic,
  LegacyAdapterType,
  LoadPolicy,
  ProjectConfig,
} from "../domain/types.js";
import { CONFIG_VERSION, CONFIG_VERSION_2 } from "../domain/types.js";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const LOAD_POLICIES = new Set<LoadPolicy>(["always", "on-demand"]);
const MAX_DOCUMENTS = 256;
const MAX_ADAPTERS = 32;
const MAX_TRIGGERS = 32;
const V1_ADAPTERS = new Set<LegacyAdapterType>(["codex", "claude"]);
const V2_ADAPTERS = new Set<AdapterSurfaceType>(["agents", "claude", "gemini"]);

export interface DecodeResult {
  config?: ProjectConfig;
  diagnostics: Diagnostic[];
}

export function decodeConfig(input: unknown): DecodeResult {
  const diagnostics: Diagnostic[] = [];
  if (!isRecord(input)) {
    return {
      diagnostics: [error("E_CONFIG_TYPE", "Configuration must be a YAML mapping.")],
    };
  }

  const version = input["version"];
  if (version !== CONFIG_VERSION && version !== CONFIG_VERSION_2) {
    diagnostics.push(
      error(
        "E_CONFIG_VERSION",
        `Unsupported configuration version: ${String(version)}. Supported versions: ${CONFIG_VERSION}, ${CONFIG_VERSION_2}.`,
        "version",
      ),
    );
  }
  const isV2 = version === CONFIG_VERSION_2;
  rejectUnknownKeys(
    input,
    isV2
      ? ["version", "project", "documents", "adapters", "continuity", "policies"]
      : ["version", "project", "documents", "adapters", "policies"],
    "$",
    diagnostics,
  );

  const project = decodeProject(input["project"], diagnostics);
  const documents = decodeDocuments(input["documents"], diagnostics);
  const adapters = decodeAdapters(input["adapters"], diagnostics, isV2 ? V2_ADAPTERS : V1_ADAPTERS);
  const continuity = isV2
    ? decodeContinuity(input["continuity"], documents, diagnostics)
    : undefined;
  const policies = decodePolicies(input["policies"], diagnostics);

  if (
    diagnostics.some((diagnostic) => diagnostic.level === "error") ||
    project === undefined ||
    documents === undefined ||
    adapters === undefined ||
    policies === undefined ||
    (isV2 && continuity === undefined)
  ) {
    return { diagnostics };
  }

  if (isV2) {
    if (continuity === undefined) return { diagnostics };
    return {
      config: {
        version: CONFIG_VERSION_2,
        project,
        documents,
        adapters: adapters as AdapterConfigV2[],
        continuity,
        policies,
      } as ProjectConfig,
      diagnostics,
    };
  }
  return {
    config: {
      version: CONFIG_VERSION,
      project,
      documents,
      adapters: adapters as AdapterConfigV1[],
      policies,
    } as ProjectConfig,
    diagnostics,
  };
}

function decodeProject(
  input: unknown,
  diagnostics: Diagnostic[],
): ProjectConfig["project"] | undefined {
  if (!isRecord(input)) {
    diagnostics.push(error("E_PROJECT_TYPE", "project must be a mapping.", "project"));
    return undefined;
  }
  rejectUnknownKeys(input, ["name"], "project", diagnostics);
  const name = requiredString(input["name"], "project.name", diagnostics, {
    singleLine: true,
    maxLength: 120,
  });
  return name === undefined ? undefined : { name };
}

function decodeDocuments(input: unknown, diagnostics: Diagnostic[]): ContextDocument[] | undefined {
  if (!Array.isArray(input) || input.length === 0) {
    diagnostics.push(
      error("E_DOCUMENTS_TYPE", "documents must be a non-empty sequence.", "documents"),
    );
    return undefined;
  }
  if (input.length > MAX_DOCUMENTS) {
    diagnostics.push(
      error(
        "E_DOCUMENT_LIMIT",
        `documents must not contain more than ${MAX_DOCUMENTS} entries.`,
        "documents",
      ),
    );
  }

  const documents: ContextDocument[] = [];
  for (const [index, item] of input.slice(0, MAX_DOCUMENTS).entries()) {
    const location = `documents[${index}]`;
    if (!isRecord(item)) {
      diagnostics.push(error("E_DOCUMENT_TYPE", "Document must be a mapping.", location));
      continue;
    }
    rejectUnknownKeys(
      item,
      ["id", "path", "load", "description", "triggers"],
      location,
      diagnostics,
    );

    const id = requiredString(item["id"], `${location}.id`, diagnostics, { maxLength: 64 });
    if (id !== undefined && !ID_PATTERN.test(id)) {
      diagnostics.push(
        error(
          "E_DOCUMENT_ID",
          "Document id must start with a lowercase letter and contain only lowercase letters, digits, and hyphens.",
          `${location}.id`,
        ),
      );
    }
    const documentPath = requiredString(item["path"], `${location}.path`, diagnostics);
    if (documentPath !== undefined) {
      collectPathError(documentPath, `${location}.path`, diagnostics);
    }
    const load = requiredString(item["load"], `${location}.load`, diagnostics);
    if (load !== undefined && !LOAD_POLICIES.has(load as LoadPolicy)) {
      diagnostics.push(
        error("E_LOAD_POLICY", "load must be 'always' or 'on-demand'.", `${location}.load`),
      );
    }
    const description = requiredString(
      item["description"],
      `${location}.description`,
      diagnostics,
      {
        singleLine: true,
        maxLength: 240,
      },
    );
    const triggers = optionalStringArray(item["triggers"], `${location}.triggers`, diagnostics);

    if (
      id !== undefined &&
      ID_PATTERN.test(id) &&
      documentPath !== undefined &&
      load !== undefined &&
      LOAD_POLICIES.has(load as LoadPolicy) &&
      description !== undefined &&
      triggers !== null
    ) {
      const base = {
        id,
        path: documentPath,
        load: load as LoadPolicy,
        description,
      };
      documents.push(triggers === undefined ? base : { ...base, triggers });
    }
  }

  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const document of documents) {
    if (ids.has(document.id)) {
      diagnostics.push(error("E_DOCUMENT_ID_DUPLICATE", `Duplicate document id: ${document.id}`));
    }
    const pathKey = portablePathKey(document.path);
    if (paths.has(pathKey)) {
      diagnostics.push(
        error("E_DOCUMENT_PATH_DUPLICATE", `Duplicate document path: ${document.path}`),
      );
    }
    ids.add(document.id);
    paths.add(pathKey);
  }
  if (!documents.some((document) => document.load === "always")) {
    diagnostics.push(error("E_ALWAYS_DOCUMENT", "At least one document must use load: always."));
  }

  return documents;
}

function decodeAdapters(
  input: unknown,
  diagnostics: Diagnostic[],
  allowedTypes: ReadonlySet<string>,
): AdapterConfig[] | undefined {
  if (!Array.isArray(input) || input.length === 0) {
    diagnostics.push(
      error("E_ADAPTERS_TYPE", "adapters must be a non-empty sequence.", "adapters"),
    );
    return undefined;
  }
  if (input.length > MAX_ADAPTERS) {
    diagnostics.push(
      error(
        "E_ADAPTER_LIMIT",
        `adapters must not contain more than ${MAX_ADAPTERS} entries.`,
        "adapters",
      ),
    );
  }

  const adapters: AdapterConfig[] = [];
  for (const [index, item] of input.slice(0, MAX_ADAPTERS).entries()) {
    const location = `adapters[${index}]`;
    if (!isRecord(item)) {
      diagnostics.push(error("E_ADAPTER_TYPE", "Adapter must be a mapping.", location));
      continue;
    }
    rejectUnknownKeys(item, ["type", "output"], location, diagnostics);
    const type = requiredString(item["type"], `${location}.type`, diagnostics);
    if (type !== undefined && (!isAdapterType(type) || !allowedTypes.has(type))) {
      diagnostics.push(
        error("E_ADAPTER_KIND", `Unsupported adapter type: ${type}`, `${location}.type`),
      );
    }
    const output = requiredString(item["output"], `${location}.output`, diagnostics);
    if (output !== undefined) {
      collectPathError(output, `${location}.output`, diagnostics);
    }
    if (
      type !== undefined &&
      isAdapterType(type) &&
      allowedTypes.has(type) &&
      output !== undefined
    ) {
      adapters.push({ type, output });
    }
  }

  const outputs = new Set<string>();
  for (const adapter of adapters) {
    const outputKey = portablePathKey(adapter.output);
    if (outputs.has(outputKey)) {
      diagnostics.push(
        error("E_ADAPTER_OUTPUT_DUPLICATE", `Duplicate adapter output: ${adapter.output}`),
      );
    }
    outputs.add(outputKey);
  }
  return adapters;
}

function decodeContinuity(
  input: unknown,
  documents: ContextDocument[] | undefined,
  diagnostics: Diagnostic[],
): { checkpointDocument: string; generateSkills: boolean } | undefined {
  if (!isRecord(input)) {
    diagnostics.push(error("E_CONTINUITY_TYPE", "continuity must be a mapping.", "continuity"));
    return undefined;
  }
  rejectUnknownKeys(input, ["checkpointDocument", "generateSkills"], "continuity", diagnostics);
  const checkpointDocument = requiredString(
    input["checkpointDocument"],
    "continuity.checkpointDocument",
    diagnostics,
    { maxLength: 64 },
  );
  if (checkpointDocument !== undefined && !ID_PATTERN.test(checkpointDocument)) {
    diagnostics.push(
      error(
        "E_CHECKPOINT_DOCUMENT_ID",
        "checkpointDocument must be a valid document id.",
        "continuity.checkpointDocument",
      ),
    );
  }
  const generateSkills = input["generateSkills"];
  if (typeof generateSkills !== "boolean") {
    diagnostics.push(
      error(
        "E_CONTINUITY_SKILLS",
        "continuity.generateSkills must be a boolean.",
        "continuity.generateSkills",
      ),
    );
  }
  if (
    checkpointDocument !== undefined &&
    ID_PATTERN.test(checkpointDocument) &&
    documents !== undefined
  ) {
    const checkpoint = documents.find((document) => document.id === checkpointDocument);
    if (checkpoint === undefined) {
      diagnostics.push(
        error(
          "E_CHECKPOINT_DOCUMENT",
          `Checkpoint document id does not exist: ${checkpointDocument}`,
          "continuity.checkpointDocument",
        ),
      );
    } else if (checkpoint.load !== "always") {
      diagnostics.push(
        error(
          "E_CHECKPOINT_LOAD_POLICY",
          "The checkpoint document must use load: always.",
          "continuity.checkpointDocument",
        ),
      );
    }
  }
  return checkpointDocument !== undefined &&
    ID_PATTERN.test(checkpointDocument) &&
    typeof generateSkills === "boolean" &&
    documents?.some((document) => document.id === checkpointDocument && document.load === "always")
    ? { checkpointDocument, generateSkills }
    : undefined;
}

function decodePolicies(
  input: unknown,
  diagnostics: Diagnostic[],
): ProjectConfig["policies"] | undefined {
  if (!isRecord(input)) {
    diagnostics.push(error("E_POLICIES_TYPE", "policies must be a mapping.", "policies"));
    return undefined;
  }
  rejectUnknownKeys(
    input,
    ["maxAlwaysCharacters", "maxAdapterCharacters"],
    "policies",
    diagnostics,
  );
  const alwaysMaximum = boundedInteger(
    input["maxAlwaysCharacters"],
    "policies.maxAlwaysCharacters",
    diagnostics,
  );
  const adapterMaximum = boundedInteger(
    input["maxAdapterCharacters"],
    "policies.maxAdapterCharacters",
    diagnostics,
  );
  if (alwaysMaximum === undefined || adapterMaximum === undefined) {
    return undefined;
  }
  return {
    maxAlwaysCharacters: alwaysMaximum,
    maxAdapterCharacters: adapterMaximum,
  };
}

function boundedInteger(
  input: unknown,
  location: string,
  diagnostics: Diagnostic[],
): number | undefined {
  if (!Number.isInteger(input) || (input as number) < 1_000 || (input as number) > 100_000) {
    diagnostics.push(
      error(
        "E_CONTEXT_BUDGET",
        `${location} must be an integer between 1000 and 100000.`,
        location,
      ),
    );
    return undefined;
  }
  return input as number;
}

function requiredString(
  input: unknown,
  location: string,
  diagnostics: Diagnostic[],
  constraints: { singleLine?: boolean; maxLength?: number } = {},
): string | undefined {
  if (typeof input !== "string" || input.trim().length === 0) {
    diagnostics.push(error("E_REQUIRED_STRING", "Value must be a non-empty string.", location));
    return undefined;
  }
  const value = input;
  if (!isWellFormedUnicode(value)) {
    diagnostics.push(
      error("E_UNICODE", "Value must contain well-formed Unicode scalar values.", location),
    );
    return undefined;
  }
  if (value !== value.trim()) {
    diagnostics.push(
      error(
        "E_SURROUNDING_WHITESPACE",
        "Value must not contain leading or trailing whitespace.",
        location,
      ),
    );
    return undefined;
  }
  if (constraints.singleLine === true && hasUnsafeLineControl(value)) {
    diagnostics.push(
      error("E_SINGLE_LINE", "Value must be one line without control characters.", location),
    );
    return undefined;
  }
  if (constraints.maxLength !== undefined && [...value].length > constraints.maxLength) {
    diagnostics.push(
      error(
        "E_STRING_LENGTH",
        `Value must not exceed ${constraints.maxLength} characters.`,
        location,
      ),
    );
    return undefined;
  }
  if (value.includes("agent-context-kit:managed:")) {
    diagnostics.push(
      error("E_RESERVED_MARKER", "Value contains reserved managed-block text.", location),
    );
    return undefined;
  }
  return value;
}

function optionalStringArray(
  input: unknown,
  location: string,
  diagnostics: Diagnostic[],
): string[] | undefined | null {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input) || input.length === 0) {
    diagnostics.push(
      error("E_STRING_ARRAY", "Value must be a non-empty string sequence.", location),
    );
    return null;
  }
  if (input.length > MAX_TRIGGERS) {
    diagnostics.push(
      error(
        "E_TRIGGER_LIMIT",
        `Value must not contain more than ${MAX_TRIGGERS} entries.`,
        location,
      ),
    );
    return null;
  }
  const values: string[] = [];
  for (const [index, item] of input.entries()) {
    const value = requiredString(item, `${location}[${index}]`, diagnostics, {
      singleLine: true,
      maxLength: 120,
    });
    if (value === undefined) {
      return null;
    }
    values.push(value);
  }
  return values;
}

function collectPathError(value: string, location: string, diagnostics: Diagnostic[]): void {
  try {
    assertPortableRelativePath(value);
  } catch (pathError) {
    const message = pathError instanceof Error ? pathError.message : String(pathError);
    diagnostics.push(error("E_CONFIG_PATH", message, location));
  }
}

function rejectUnknownKeys(
  input: Record<string, unknown>,
  allowed: string[],
  location: string,
  diagnostics: Diagnostic[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(input)) {
    if (!allowedSet.has(key)) {
      diagnostics.push(
        error(
          "E_UNKNOWN_KEY",
          `Unknown configuration key: ${location === "$" ? key : `${location}.${key}`}`,
        ),
      );
    }
  }
}

function error(code: string, message: string, path?: string): Diagnostic {
  const diagnostic: Diagnostic = { level: "error", code, message };
  if (path !== undefined) {
    diagnostic.path = path;
  }
  return diagnostic;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
