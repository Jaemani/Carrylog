import { randomUUID } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import { chmod, lstat, mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { issueError } from "./errors.js";

export const DEFAULT_MAX_TEXT_BYTES = 5 * 1024 * 1024;

export async function readTextIfExists(
  filePath: string,
  options: { maxBytes?: number } = {},
): Promise<string | undefined> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_TEXT_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }

  let handle: FileHandle;
  try {
    handle = await open(filePath, "r");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }

  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      throw issueError("E_NOT_REGULAR_FILE", `Expected a regular file: ${filePath}`);
    }
    if (metadata.size > maxBytes) {
      throw issueError(
        "E_FILE_TOO_LARGE",
        `Text file exceeds the ${maxBytes}-byte safety limit: ${filePath}`,
      );
    }

    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const remaining = maxBytes - total + 1;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) {
        break;
      }
      total += bytesRead;
      if (total > maxBytes) {
        throw issueError(
          "E_FILE_TOO_LARGE",
          `Text file exceeds the ${maxBytes}-byte safety limit: ${filePath}`,
        );
      }
      chunks.push(buffer.subarray(0, bytesRead));
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, total));
    } catch (error) {
      throw issueError(
        "E_FILE_ENCODING",
        `Text file is not valid UTF-8: ${filePath}`,
        error instanceof Error ? error.message : undefined,
      );
    }
  } finally {
    await handle.close();
  }
}

export async function atomicWriteText(filePath: string, content: string): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });

  const existingMode = await getModeIfExists(filePath);
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);

  try {
    await writeFile(temporaryPath, content, {
      encoding: "utf8",
      flag: "wx",
      mode: existingMode ?? 0o644,
    });
    if (existingMode !== undefined) {
      await chmod(temporaryPath, existingMode);
    }
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function getModeIfExists(filePath: string): Promise<number | undefined> {
  try {
    return (await lstat(filePath)).mode;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
