import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

export const PROCESS_STATES = Object.freeze({
  completed: "completed",
  timeout: "timeout",
  outputLimit: "output-limit",
  spawnError: "spawn-error",
  signal: "signal",
});

// This is deliberately not configurable by callers: all verification surfaces
// receive the same bounded termination behavior.
export const TERMINATION_GRACE_MS = 500;

// A child can exit while one of its descendants keeps an inherited output
// pipe open.  Do not let that prevent the supervisor from settling forever
// after the process group has received SIGKILL.
export const FINALIZATION_GRACE_MS = 500;

// Simultaneous observations choose the greatest value, keeping receipts
// stable even when timers, streams, aborts, and spawn events interleave.
export const PROCESS_STATE_PRECEDENCE = Object.freeze({
  [PROCESS_STATES.completed]: 0,
  [PROCESS_STATES.signal]: 1,
  [PROCESS_STATES.timeout]: 2,
  [PROCESS_STATES.outputLimit]: 3,
  [PROCESS_STATES.spawnError]: 4,
});

/**
 * Execute one argv command without a shell, retaining at most maxOutputBytes
 * across stdout and stderr.  Raw output stays in the returned Buffers; this
 * module never writes command output or environment values to a log.
 */
export async function superviseProcess({
  executable,
  arguments: arguments_ = [],
  cwd,
  env,
  timeoutMs,
  maxOutputBytes,
  signal,
  stdin = "closed",
}) {
  assert.equal(typeof executable, "string", "executable must be a string");
  assert.ok(executable.length > 0, "executable must not be empty");
  assert.ok(Array.isArray(arguments_), "arguments must be an array");
  assert.ok(
    arguments_.every((value) => typeof value === "string"),
    "arguments must be strings",
  );
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0, "timeoutMs must be positive");
  assert.ok(
    Number.isSafeInteger(maxOutputBytes) && maxOutputBytes >= 0,
    "maxOutputBytes must be a non-negative safe integer",
  );
  assert.ok(signal === undefined || isAbortSignal(signal), "signal must be an AbortSignal");
  assert.equal(stdin, "closed", "stdin must be closed");

  return await new Promise((resolve) => {
    const output = createOutputCapture(maxOutputBytes);
    let child;
    let settled = false;
    let closeSeen = false;
    let exitSeen = false;
    let exitCode = null;
    let exitSignal = null;
    let selectedState = null;
    let spawnError = null;
    let terminationRequested = false;
    let sigtermSent = false;
    let sigkillSent = false;
    let signalFailure = null;
    let completionForced = false;
    let timeoutHandle = null;
    let killHandle = null;
    let finalizationHandle = null;
    let abortListener = null;
    const processGroupSignals = process.platform !== "win32";

    const select = (state) => {
      if (
        selectedState === null ||
        PROCESS_STATE_PRECEDENCE[state] > PROCESS_STATE_PRECEDENCE[selectedState]
      ) {
        selectedState = state;
      }
    };
    const sendSignal = (name) => {
      if (child === undefined || child.pid === undefined) return false;
      try {
        if (processGroupSignals) {
          process.kill(-child.pid, name);
          return true;
        }
        return child.kill(name);
      } catch (error) {
        if (errorCode(error) === "ESRCH") return false;
        signalFailure ??= `${name}:${errorCode(error)}`;
        return false;
      }
    };
    const forceCompletion = () => {
      if (settled || closeSeen) return;
      completionForced = true;
      child?.stdin?.destroy();
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      closeSeen = true;
      finish();
    };
    const terminate = () => {
      if (child === undefined || child.pid === undefined || closeSeen) return;
      sigtermSent ||= sendSignal("SIGTERM");
      if (killHandle === null) {
        killHandle = setTimeout(() => {
          if (closeSeen) return;
          sigkillSent ||= sendSignal("SIGKILL");
          if (finalizationHandle === null) {
            finalizationHandle = setTimeout(forceCompletion, FINALIZATION_GRACE_MS);
          }
        }, TERMINATION_GRACE_MS);
      }
    };
    const requestTermination = (state) => {
      select(state);
      // A failed spawn has no child PID. Calling ChildProcess.kill() in that
      // state is not a valid termination operation and must never target a
      // process group by accident.
      terminationRequested ||= child !== undefined && child.pid !== undefined;
      terminate();
    };
    const finish = () => {
      if (settled || !closeSeen) return;
      settled = true;
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      if (killHandle !== null) clearTimeout(killHandle);
      if (finalizationHandle !== null) clearTimeout(finalizationHandle);
      if (abortListener !== null && signal !== undefined)
        signal.removeEventListener("abort", abortListener);
      if (selectedState === null) {
        select(exitSignal === null ? PROCESS_STATES.completed : PROCESS_STATES.signal);
      }
      resolve({
        state: selectedState,
        exitCode,
        signal: exitSignal,
        spawnError,
        termination: terminationRequested
          ? {
              firstSignal: "SIGTERM",
              firstSignalSent: sigtermSent,
              signalScope: processGroupSignals ? "process-group" : "process",
              graceMs: TERMINATION_GRACE_MS,
              escalationSignal: "SIGKILL",
              escalationSent: sigkillSent,
              finalizationGraceMs: FINALIZATION_GRACE_MS,
              completionForced,
              signalFailure,
            }
          : null,
        output: output.finish(),
      });
    };

    try {
      child = spawn(executable, arguments_, {
        cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
        detached: processGroupSignals,
      });
    } catch (error) {
      // Node normally reports spawn failures through `error`, but preserve a
      // synchronous failure with the same deterministic terminal state.
      select(PROCESS_STATES.spawnError);
      spawnError = errorCode(error);
      closeSeen = true;
      finish();
      return;
    }

    child.stdin.end();
    child.stdout.on("data", (chunk) => {
      output.add("stdout", chunk);
      if (output.limitReached) requestTermination(PROCESS_STATES.outputLimit);
    });
    child.stderr.on("data", (chunk) => {
      output.add("stderr", chunk);
      if (output.limitReached) requestTermination(PROCESS_STATES.outputLimit);
    });
    child.once("error", (error) => {
      spawnError = errorCode(error);
      requestTermination(PROCESS_STATES.spawnError);
    });
    child.once("exit", (code, childSignal) => {
      exitSeen = true;
      exitCode = code;
      exitSignal = childSignal;
    });
    child.once("close", (code, childSignal) => {
      closeSeen = true;
      if (!exitSeen) {
        exitCode = code;
        exitSignal = childSignal;
      }
      finish();
    });

    timeoutHandle = setTimeout(() => requestTermination(PROCESS_STATES.timeout), timeoutMs);
    abortListener = () => requestTermination(PROCESS_STATES.signal);
    if (signal !== undefined) {
      signal.addEventListener("abort", abortListener, { once: true });
      if (signal.aborted) abortListener();
    }
  });
}

function createOutputCapture(maximum) {
  const streams = {
    stdout: { received: 0, retained: 0, chunks: [] },
    stderr: { received: 0, retained: 0, chunks: [] },
  };
  let retained = 0;
  let limitReached = false;
  return {
    get limitReached() {
      return limitReached;
    },
    add(name, chunk) {
      const bytes = Buffer.from(chunk);
      const stream = streams[name];
      stream.received += bytes.length;
      const remaining = maximum - retained;
      const kept = remaining > 0 ? bytes.subarray(0, remaining) : Buffer.alloc(0);
      if (kept.length > 0) {
        stream.chunks.push(kept);
        stream.retained += kept.length;
        retained += kept.length;
      }
      if (bytes.length > kept.length) limitReached = true;
    },
    finish() {
      return {
        limitBytes: maximum,
        retainedBytes: retained,
        limitReached,
        stdout: finishStream(streams.stdout, limitReached),
        stderr: finishStream(streams.stderr, limitReached),
      };
    },
  };
}

function finishStream(stream, outputTruncated) {
  const buffer = Buffer.concat(stream.chunks, stream.retained);
  const complete = !outputTruncated;
  return {
    buffer,
    receivedBytes: stream.received,
    retainedBytes: stream.retained,
    retainedSha256: digest(buffer),
    // The complete-output digest is only meaningful when no bytes were
    // discarded due to the shared cap.
    sha256: complete ? digest(buffer) : null,
    complete,
  };
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function errorCode(error) {
  if (error && typeof error === "object" && typeof error.code === "string") return error.code;
  return "UNKNOWN_SPAWN_ERROR";
}

function isAbortSignal(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.aborted === "boolean" &&
    typeof value.addEventListener === "function" &&
    typeof value.removeEventListener === "function"
  );
}
