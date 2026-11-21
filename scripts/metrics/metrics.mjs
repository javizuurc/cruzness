#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const supportedSetups = ["vanilla", "gentleai", "cruzness"];
const detailFields = ["assistantTurns", "toolCalls", "delegationCalls", "subagents"];

function average(runs, metric) {
  return runs.reduce((sum, run) => sum + metric(run), 0) / runs.length;
}

try {
  const [runsFile, ...args] = process.argv.slice(2);
  const setupFile = args.length === 1 || args[0] !== "--setups" ? args.shift() : undefined;
  let setups = supportedSetups;
  if (args[0] === "--setups" && args.length === 2) {
    const requested = args[1].split(",");
    args.length = 0;
    if (
      requested.length < 2 ||
      new Set(requested).size !== requested.length ||
      !requested.includes("vanilla") ||
      requested.some((name) => !supportedSetups.includes(name))
    ) {
      throw new Error("--setups requires vanilla and at least one other distinct known setup");
    }
    setups = supportedSetups.filter((name) => requested.includes(name));
  }
  if (!runsFile || args.length)
    throw new Error(
      "Usage: node scripts/metrics/metrics.mjs <runs.json> [setup-times.json] [--setups <comma-separated-setups>]",
    );
  const records = JSON.parse(await readFile(runsFile, "utf8"));
  if (!Array.isArray(records) || !records.length)
    throw new Error("Run file must contain a non-empty JSON array");
  if (records.some((run) => !supportedSetups.includes(run.setup)))
    throw new Error("Runs must use vanilla, gentleai, or cruzness");
  const runs = records.filter((run) => setups.includes(run.setup));

  const bySetup = Object.fromEntries(
    setups.map((setup) => [setup, runs.filter((run) => run.setup === setup)]),
  );
  const count = bySetup.vanilla.length;
  if (!count || setups.some((setup) => bySetup[setup].length !== count)) {
    throw new Error("Each setup must contain the same non-zero number of runs");
  }

  for (let index = 0; index < count; index++) {
    const reference = bySetup.vanilla[index];
    for (const setup of setups.slice(1)) {
      for (const field of ["task", "model", "promptHash"]) {
        if (!reference[field] || reference[field] !== bySetup[setup][index][field]) {
          throw new Error(`Run ${index + 1} must have the same ${field} across all setups`);
        }
      }
    }
  }
  for (const run of runs) {
    if (!run.task || !run.model || !run.promptHash || typeof run.success !== "boolean") {
      throw new Error("Each run must include task, model, promptHash, and boolean success");
    }
    for (const field of ["inputTokens", "outputTokens", "steps", "durationSeconds"]) {
      if (typeof run[field] !== "number" || !Number.isFinite(run[field]) || run[field] < 0) {
        throw new Error(`${field} must be a non-negative number`);
      }
    }
    for (const field of detailFields) {
      const value = run[field];
      if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
        throw new Error(`${field} must be a non-negative integer or null`);
      }
    }
  }
  for (const task of new Set(runs.map((run) => run.task))) {
    const taskRuns = runs.filter((run) => run.task === task);
    for (const field of ["model", "promptHash"]) {
      if (new Set(taskRuns.map((run) => run[field])).size !== 1) {
        throw new Error(`Task ${task} must use the same ${field} across repetitions`);
      }
    }
  }

  const taskNames = [...new Set(runs.map((run) => run.task))];
  const tasks = Object.fromEntries(
    taskNames.map((task) => {
      const details = detailFields.filter((field) =>
        runs.some((run) => run.task === task && Object.hasOwn(run, field)),
      );
      const summaries = Object.fromEntries(
        setups.map((setup) => {
          const selected = bySetup[setup].filter((run) => run.task === task);
          return [
            setup,
            {
              runs: selected.length,
              successRate: average(selected, (run) => Number(run.success)),
              tokens: average(selected, (run) => run.inputTokens + run.outputTokens),
              steps: average(selected, (run) => run.steps),
              durationSeconds: average(selected, (run) => run.durationSeconds),
              ...Object.fromEntries(
                details.map((field) => [
                  field,
                  selected.every((run) => run[field] != null)
                    ? average(selected, (run) => run[field])
                    : null,
                ]),
              ),
            },
          ];
        }),
      );
      const vsVanilla = Object.fromEntries(
        setups
          .slice(1)
          .map((setup) => [
            setup,
            Object.fromEntries(
              ["successRate", "tokens", "steps", "durationSeconds", ...details].map((metric) => [
                metric,
                summaries[setup][metric] == null || summaries.vanilla[metric] == null
                  ? null
                  : summaries[setup][metric] - summaries.vanilla[metric],
              ]),
            ),
          ]),
      );
      return [task, { ...summaries, vsVanilla }];
    }),
  );

  let setup = null;
  if (setupFile) {
    const data = JSON.parse(await readFile(setupFile, "utf8"));
    if (
      !Array.isArray(data.runs) ||
      !data.runs.length ||
      data.runs.some(
        (run) =>
          !supportedSetups.includes(run.setup) ||
          typeof run.minutes !== "number" ||
          !Number.isFinite(run.minutes) ||
          run.minutes < 0,
      )
    ) {
      throw new Error(
        "Setup times must contain runs for vanilla, gentleai, or cruzness with non-negative minutes",
      );
    }
    setup = Object.fromEntries(
      setups.map((name) => {
        const selected = data.runs.filter((run) => run.setup === name);
        return [
          name,
          {
            runs: selected.length,
            averageMinutes: selected.length ? average(selected, (run) => run.minutes) : null,
          },
        ];
      }),
    );
  }
  console.log(JSON.stringify({ tasks, setup }, null, 2));
} catch (error) {
  console.error(`Metrics comparison failed: ${error.message}`);
  process.exit(1);
}
