import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, "..");

export async function generateOrder(root = defaultRoot) {
  const preregistration = JSON.parse(
    await readFile(path.join(root, "preregistration.json"), "utf8"),
  );
  const fixtures = await Promise.all(
    (await readdir(path.join(root, "tasks")))
      .filter((entry) => entry.endsWith(".json"))
      .sort()
      .map(async (entry) => {
        const task = JSON.parse(await readFile(path.join(root, "tasks", entry), "utf8"));
        return {
          fixtureId: entry.slice(0, -5),
          repository: task.repository.id.replace(/^r\d+-/, ""),
        };
      }),
  );
  const seed = preregistration.controls.runOrderSeed;
  const conditionPermutations = [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
    [0, 2, 1],
    [2, 1, 0],
    [1, 0, 2],
  ];
  const blocks = [];
  for (const fixture of fixtures) {
    for (const harness of preregistration.matrix.harnesses) {
      const blockKey = `${fixture.fixtureId}|${harness}`;
      blocks.push({
        orderKey: digest(`${seed}|block|${blockKey}`),
        fixtureId: fixture.fixtureId,
        repository: fixture.repository,
        harness,
      });
    }
  }
  const assignmentByBlock = assignBalancedPermutations(
    blocks,
    preregistration.matrix.harnesses,
    preregistration.matrix.repositories,
    conditionPermutations,
    seed,
  );
  const blindIdByCell = new Map(
    [...blocks]
      .sort((left, right) => left.orderKey.localeCompare(right.orderKey))
      .flatMap((block) => {
        const permutation = assignmentByBlock.get(`${block.fixtureId}|${block.harness}`);
        return permutation.map((conditionIndex) => ({
          fixtureId: block.fixtureId,
          condition: preregistration.matrix.conditions[conditionIndex],
          harness: block.harness,
        }));
      })
      .map((run, index) => [
        `${run.fixtureId}|${run.condition}|${run.harness}`,
        `b-${digest(`${seed}|blind|${index + 1}`).slice(0, 12)}`,
      ]),
  );
  const initialComparisonBlocks = preregistration.controls.initialComparisonBlocks ?? [];
  const initialPosition = new Map(initialComparisonBlocks.map((key, index) => [key, index]));
  blocks.sort((left, right) => {
    const leftPosition = initialPosition.get(`${left.fixtureId}|${left.harness}`);
    const rightPosition = initialPosition.get(`${right.fixtureId}|${right.harness}`);
    if (leftPosition !== undefined || rightPosition !== undefined) {
      if (leftPosition === undefined) return 1;
      if (rightPosition === undefined) return -1;
      return leftPosition - rightPosition;
    }
    return left.orderKey.localeCompare(right.orderKey);
  });
  const combinations = blocks.flatMap((block) => {
    const permutation = assignmentByBlock.get(`${block.fixtureId}|${block.harness}`);
    return permutation.map((conditionIndex) => ({
      fixtureId: block.fixtureId,
      condition: preregistration.matrix.conditions[conditionIndex],
      harness: block.harness,
    }));
  });
  return {
    formatVersion: 1,
    seed,
    method:
      "Preregistered Carrylog verification repair blocks first, then SHA-256 randomized fixture-harness blocks; each harness-repository stratum uses five of six condition permutations and paired omitted permutations are deranged to balance both stratum and harness positions",
    runs: combinations.map((run, index) => ({
      ordinal: index + 1,
      runId: `t1-${String(index + 1).padStart(3, "0")}`,
      blindId: blindIdByCell.get(`${run.fixtureId}|${run.condition}|${run.harness}`),
      ...run,
    })),
  };
}

function assignBalancedPermutations(blocks, harnesses, repositories, permutations, seed) {
  if (repositories.length !== 2) {
    throw new Error("Tier 1 balancing requires exactly two repository strata");
  }
  const assignments = new Map();
  for (const harness of harnesses) {
    assertThreeConditions(permutations);
    const firstExcluded =
      Number.parseInt(digest(`${seed}|excluded|${harness}`).slice(0, 8), 16) % permutations.length;
    const excludedByRepository = [firstExcluded];
    for (let index = 1; index < repositories.length; index += 1) {
      const previous = permutations[excludedByRepository[index - 1]];
      const candidates = permutations
        .map((permutation, permutationIndex) => ({
          permutation,
          permutationIndex,
        }))
        .filter(({ permutation }) =>
          permutation.every((value, position) => value !== previous[position]),
        )
        .sort((left, right) =>
          digest(
            `${seed}|excluded|${harness}|${repositories[index]}|${left.permutationIndex}`,
          ).localeCompare(
            digest(`${seed}|excluded|${harness}|${repositories[index]}|${right.permutationIndex}`),
          ),
        );
      if (candidates.length === 0) throw new Error("no deranged condition permutation exists");
      excludedByRepository.push(candidates[0].permutationIndex);
    }
    for (const [repositoryIndex, repository] of repositories.entries()) {
      const stratum = blocks
        .filter((block) => block.harness === harness && block.repository === repository)
        .sort((left, right) =>
          digest(`${seed}|stratum-block|${left.fixtureId}|${harness}`).localeCompare(
            digest(`${seed}|stratum-block|${right.fixtureId}|${harness}`),
          ),
        );
      const available = permutations
        .map((permutation, permutationIndex) => ({
          permutation,
          permutationIndex,
        }))
        .filter(
          ({ permutationIndex }) => permutationIndex !== excludedByRepository[repositoryIndex],
        )
        .sort((left, right) =>
          digest(
            `${seed}|assignment|${harness}|${repository}|${left.permutationIndex}`,
          ).localeCompare(
            digest(`${seed}|assignment|${harness}|${repository}|${right.permutationIndex}`),
          ),
        );
      if (stratum.length !== available.length) {
        throw new Error(
          `${harness}|${repository} needs exactly ${available.length} fixture blocks for balance`,
        );
      }
      stratum.forEach((block, index) => {
        assignments.set(`${block.fixtureId}|${block.harness}`, available[index].permutation);
      });
    }
  }
  return assignments;
}

function assertThreeConditions(permutations) {
  if (permutations.length !== 6 || permutations.some((permutation) => permutation.length !== 3)) {
    throw new Error("Tier 1 balancing requires all six permutations of three conditions");
  }
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const mode = process.argv[2];
  const rootIndex = process.argv.indexOf("--root");
  const rootArgument = rootIndex === -1 ? undefined : process.argv[rootIndex + 1];
  if (rootIndex !== -1 && rootArgument === undefined) throw new Error("--root requires a path");
  const root = rootArgument === undefined ? defaultRoot : path.resolve(rootArgument);
  const outputPath = path.join(root, "run-order.json");
  const rendered = `${JSON.stringify(await generateOrder(root), null, 2)}\n`;
  if (mode === "--write") {
    await writeFile(outputPath, rendered, "utf8");
    process.stdout.write(`Wrote ${outputPath}\n`);
  } else if (mode === "--check") {
    const existing = await readFile(outputPath, "utf8");
    if (existing !== rendered) {
      throw new Error("run-order.json differs from the preregistered seed and matrix");
    }
    process.stdout.write("run-order.json is deterministic and current.\n");
  } else {
    throw new Error("Usage: node analysis/generate-order.mjs --write|--check");
  }
}
