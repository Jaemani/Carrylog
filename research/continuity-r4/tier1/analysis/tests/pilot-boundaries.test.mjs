import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  assertMacosPilotPlatform,
  BUSYCAFE_SOURCE_ENV,
  buildSetupInvocation,
  claimExecutionRun,
  completePilotCachePopulation,
  digestInstalledToolTree,
  PILOT_CACHE_ROOT_ENV,
  resolveBusyCafeBareSource,
  resolvePilotCacheRoot,
  withExclusiveSchedulerLock,
} from "../pilot-boundaries.mjs";

const execFileAsync = promisify(execFile);

test("Tier 1 runner fails before setup on non-macOS platforms", () => {
  assert.doesNotThrow(() => assertMacosPilotPlatform("darwin", "arm64", "arm64"));
  assert.throws(() => assertMacosPilotPlatform("linux", "arm64", "arm64"), /macOS-only/);
  assert.throws(() => assertMacosPilotPlatform("win32", "arm64", "arm64"), /macOS-only/);
  assert.throws(() => assertMacosPilotPlatform("darwin", "x64", "arm64"), /requires arm64/);
});

test("offline setup invocation denies OS network while online setup remains explicit", async () => {
  const online = buildSetupInvocation("npm", ["ci"], { allowNetwork: true });
  assert.deepEqual(online, {
    executable: "npm",
    arguments: ["ci"],
    networkPolicy: "allowed",
  });

  let connections = 0;
  const server = net.createServer((socket) => {
    connections += 1;
    socket.destroy();
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const script = `const n=require('node:net');const s=n.connect(${address.port},'127.0.0.1');s.on('connect',()=>{process.stdout.write('CONNECTED');process.exit(2)});s.on('error',()=>{process.stdout.write('NETWORK_DENIED');process.exit(0)});setTimeout(()=>process.exit(3),2000);`;
    const offline = buildSetupInvocation(process.execPath, ["-e", script], {
      allowNetwork: false,
    });
    assert.equal(offline.executable, "/usr/bin/sandbox-exec");
    assert.equal(offline.networkPolicy, "seatbelt-denied");
    const result = await execFileAsync(offline.executable, offline.arguments, {
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(result.stdout, "NETWORK_DENIED");
    assert.equal(connections, 0);
  } finally {
    server.close();
  }
});

test("pilot cache requires one explicit temporary root for artifact, npm, and uv state", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-cache-boundary-"));
  const options = { allowSetupNetwork: true, repositoryId: "busycafe" };
  try {
    await assert.rejects(resolvePilotCacheRoot({}, options), /must be set/);
    await assert.rejects(
      resolvePilotCacheRoot({ [PILOT_CACHE_ROOT_ENV]: "relative-cache" }, options),
      /must be absolute/,
    );
    const prospectiveOutside = path.join(
      process.cwd(),
      `.pilot-cache-prospective-outside-${process.pid}`,
    );
    await rm(prospectiveOutside, { recursive: true, force: true });
    await assert.rejects(
      resolvePilotCacheRoot({ [PILOT_CACHE_ROOT_ENV]: prospectiveOutside }, options),
      /must be a child of the system temporary directory/,
    );
    await assert.rejects(lstat(prospectiveOutside), /ENOENT/);
    const environment = { [PILOT_CACHE_ROOT_ENV]: path.join(parent, "cache") };
    const cache = await resolvePilotCacheRoot(environment, options);
    assert.equal(cache.root, await realpath(path.join(parent, "cache")));
    assert.deepEqual(Object.keys(cache).sort(), ["artifacts", "lifecycle", "npm", "root", "uv"]);
    for (const entry of [cache.root, cache.artifacts, cache.npm, cache.uv])
      assert.equal((await lstat(entry)).isDirectory(), true);
    assert.equal(cache.lifecycle.mode, "cold-population");
    await assert.rejects(resolvePilotCacheRoot(environment, options), /new empty root/);
    await assert.rejects(
      resolvePilotCacheRoot(environment, {
        allowSetupNetwork: false,
        repositoryId: "busycafe",
      }),
      /cache ready receipt/,
    );
    const ready = await completePilotCachePopulation(cache, {
      repositoryId: "busycafe",
      runId: "t1-001",
      toolTreeSha256: "a".repeat(64),
      carrylogTarballSha256: "b".repeat(64),
    });
    assert.equal(ready.mode, "sealed-online-population");
    const offline = await resolvePilotCacheRoot(environment, {
      allowSetupNetwork: false,
      repositoryId: "busycafe",
    });
    assert.equal(offline.lifecycle.mode, "sealed-offline-reuse");
    assert.equal(offline.lifecycle.cacheId, ready.cacheId);
    assert.equal(offline.lifecycle.readySha256, ready.readySha256);
    await assert.rejects(
      resolvePilotCacheRoot(environment, {
        allowSetupNetwork: false,
        repositoryId: "carrylog",
      }),
      /Expected values to be strictly equal|repositoryId/,
    );

    const outside = await mkdtemp(path.join(process.cwd(), ".pilot-cache-outside-"));
    try {
      await assert.rejects(
        resolvePilotCacheRoot({ [PILOT_CACHE_ROOT_ENV]: outside }, options),
        /must be a child of the system temporary directory/,
      );
      const linked = path.join(parent, "linked-cache");
      await symlink(outside, linked);
      await assert.rejects(
        resolvePilotCacheRoot({ [PILOT_CACHE_ROOT_ENV]: linked }, options),
        /must be a child of the system temporary directory|must be a directory|must not be a symbolic link/,
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("pilot cache rejects artifact, npm, and uv child links before external use", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-cache-child-boundary-"));
  const outside = await mkdtemp(path.join(tmpdir(), "carrylog-cache-child-outside-"));
  try {
    for (const name of ["artifacts", "npm", "uv"]) {
      const root = path.join(parent, name);
      await mkdir(root, { mode: 0o700 });
      for (const sibling of ["artifacts", "npm", "uv"]) {
        if (sibling === name) await symlink(outside, path.join(root, sibling));
        else await mkdir(path.join(root, sibling), { mode: 0o700 });
      }
      await assert.rejects(
        resolvePilotCacheRoot(
          { [PILOT_CACHE_ROOT_ENV]: root },
          { allowSetupNetwork: false, repositoryId: "busycafe" },
        ),
        new RegExp(
          `pilot cache ${name} must be a directory|pilot cache ${name} must not be a symbolic link`,
        ),
      );
    }
    assert.deepEqual(await readdir(outside), []);
  } finally {
    await rm(parent, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("BusyCafe fixture source is mandatory, temporary, and bare", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-source-boundary-"));
  const bare = path.join(parent, "source.git");
  const worktree = path.join(parent, "worktree");
  try {
    await execFileAsync("git", ["init", "--quiet", "--bare", bare]);
    await execFileAsync("git", ["init", "--quiet", "--initial-branch=main", worktree]);
    await assert.rejects(resolveBusyCafeBareSource({}), /must be set/);
    assert.equal(
      await resolveBusyCafeBareSource({ [BUSYCAFE_SOURCE_ENV]: bare }),
      await realpath(bare),
    );
    await assert.rejects(
      resolveBusyCafeBareSource({ [BUSYCAFE_SOURCE_ENV]: worktree }),
      /must be a bare Git repository/,
    );
    await assert.rejects(
      resolveBusyCafeBareSource({ [BUSYCAFE_SOURCE_ENV]: process.cwd() }),
      /must be a child of the system temporary directory/,
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("installed tool digest binds internal npm links and rejects escaping links", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-tool-digest-"));
  try {
    await mkdir(path.join(root, "node_modules", ".bin"), { recursive: true });
    await mkdir(path.join(root, "node_modules", "carrylog", "dist"), { recursive: true });
    await writeFile(path.join(root, "node_modules", "carrylog", "dist", "cli.js"), "cli\n");
    const link = path.join(root, "node_modules", ".bin", "carrylog");
    await symlink("../carrylog/dist/cli.js", link);
    const first = await digestInstalledToolTree(root);
    assert.match(first, /^[0-9a-f]{64}$/);
    assert.equal(await digestInstalledToolTree(root), first);
    await rm(link);
    await symlink("../../../../outside", link);
    await assert.rejects(digestInstalledToolTree(root), /escapes its tree/);
    await rm(link);
    await symlink("/absolute/outside", link);
    await assert.rejects(digestInstalledToolTree(root), /is absolute/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scheduler lock is fail-closed and never removes an unexplained stale lock", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-stale-scheduler-"));
  const lockPath = path.join(root, "execution.lock");
  try {
    await writeFile(lockPath, "previous-run\n", { mode: 0o600 });
    await assert.rejects(
      withExclusiveSchedulerLock(lockPath, async () => assert.fail("must not enter"), {
        waitTimeoutMs: 20,
        pollIntervalMs: 5,
      }),
      /verify that no runner remains, then remove it explicitly/,
    );
    assert.equal(await readFile(lockPath, "utf8"), "previous-run\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("concurrent predecessor checks and claims cannot admit a later run first", async () => {
  const tierRoot = await mkdtemp(path.join(tmpdir(), "carrylog-claim-race-"));
  const moduleUrl = new URL("../pilot-boundaries.mjs", import.meta.url).href;
  const order = {
    runs: [
      { runId: "t1-001", blindId: "b-000000000001" },
      { runId: "t1-002", blindId: "b-000000000002" },
    ],
  };
  const script = `import { claimExecutionRun } from ${JSON.stringify(moduleUrl)}; const [tier,orderJson,runId]=process.argv.slice(1); const order=JSON.parse(orderJson); const selectedRun=order.runs.find((run)=>run.runId===runId); await claimExecutionRun({tierRoot:tier,order,selectedRun});`;
  try {
    await mkdir(path.join(tierRoot, "raw-reviewed"), { recursive: true });
    const calls = ["t1-001", "t1-002"].map((runId) =>
      execFileAsync(process.execPath, [
        "--input-type=module",
        "--eval",
        script,
        tierRoot,
        JSON.stringify(order),
        runId,
      ]),
    );
    const outcomes = await Promise.allSettled(calls);
    assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(
      await readFile(
        path.join(tierRoot, "raw-quarantine", "by-run", "t1-001", "claim.json"),
        "utf8",
      ).then(() => true),
      true,
    );
    await assert.rejects(
      readFile(path.join(tierRoot, "raw-quarantine", "by-run", "t1-002", "claim.json")),
      /ENOENT/,
    );
    await assert.rejects(
      readFile(path.join(tierRoot, "raw-quarantine", "execution.lock")),
      /ENOENT/,
    );
  } finally {
    await rm(tierRoot, { recursive: true, force: true });
  }
});

test("single-process claim retains the exact run and blind identity", async () => {
  const tierRoot = await mkdtemp(path.join(tmpdir(), "carrylog-claim-single-"));
  const selectedRun = { runId: "t1-001", blindId: "b-000000000001" };
  try {
    const paths = await claimExecutionRun({
      tierRoot,
      order: { runs: [selectedRun] },
      selectedRun,
    });
    const claim = JSON.parse(await readFile(path.join(paths.byRunPath, "claim.json"), "utf8"));
    assert.equal(claim.runId, selectedRun.runId);
    assert.equal(claim.blindId, selectedRun.blindId);
  } finally {
    await rm(tierRoot, { recursive: true, force: true });
  }
});
