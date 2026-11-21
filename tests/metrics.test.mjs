import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const script = fileURLToPath(new URL("../scripts/metrics/metrics.mjs", import.meta.url));
const importer = fileURLToPath(new URL("../scripts/metrics/metrics-import.mjs", import.meta.url));
const setupTimer = fileURLToPath(new URL("../scripts/metrics/setup-timer.mjs", import.meta.url));

describe("metrics comparison", () => {
  it("imports task metrics and setup identity from an OpenCode export without storing prompt text", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cruzness-metrics-"));
    try {
      const exportPath = join(dir, "session.json");
      const outputPath = join(dir, "runs.json");
      await writeFile(
        exportPath,
        JSON.stringify({
          info: { id: "ses-example" },
          messages: [
            {
              info: { role: "user", time: { created: 1000 } },
              parts: [{ type: "text", text: "Do the reference task" }],
            },
            {
              info: {
                role: "assistant",
                providerID: "provider-x",
                modelID: "model-x",
                time: { created: 1100, completed: 1800 },
                tokens: { input: 12, output: 3 },
              },
              parts: [{ type: "tool", tool: "read", state: { status: "completed" } }],
            },
            {
              info: {
                role: "assistant",
                providerID: "provider-x",
                modelID: "model-x",
                time: { created: 1850, completed: 2500 },
                tokens: { input: 20, output: 4 },
              },
              parts: [{ type: "text", text: "Done" }],
            },
          ],
        }),
      );
      const result = spawnSync(
        process.execPath,
        [
          importer,
          exportPath,
          outputPath,
          "--prompt-hash",
          "sha256:abc",
          "--task",
          "ref-1",
          "--setup",
          "gentleai",
          "--success",
          "true",
        ],
        { encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      const records = JSON.parse(await readFile(outputPath, "utf8"));
      assert.deepEqual(records, [
        {
          task: "ref-1",
          setup: "gentleai",
          model: "provider-x/model-x",
          promptHash: "sha256:abc",
          inputTokens: 32,
          outputTokens: 7,
          steps: 3,
          durationSeconds: 1.5,
          success: true,
        },
      ]);
      assert.equal(JSON.stringify(records).includes("Do the reference task"), false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("compares all three setups per task and reports success, duration, and setup averages", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cruzness-metrics-"));
    try {
      const runsPath = join(dir, "runs.json");
      const base = { task: "ref-1", model: "model-x", promptHash: "abc" };
      const run = (setup, values, success) => ({
        ...base,
        setup,
        inputTokens: values[0],
        outputTokens: values[1],
        steps: values[2],
        durationSeconds: values[3],
        success,
      });
      await writeFile(
        runsPath,
        JSON.stringify([
          run("vanilla", [10, 5, 8, 8], true),
          run("vanilla", [20, 10, 10, 10], false),
          run("vanilla", [30, 15, 12, 12], false),
          run("gentleai", [7, 4, 6, 5], true),
          run("gentleai", [14, 7, 8, 7], true),
          run("gentleai", [21, 10, 10, 9], false),
          run("cruzness", [6, 3, 5, 4], true),
          run("cruzness", [12, 6, 7, 6], true),
          run("cruzness", [18, 9, 8, 8], true),
        ]),
      );
      const setupPath = join(dir, "setup-times.json");
      await writeFile(
        setupPath,
        JSON.stringify({
          runs: [
            { id: "one", setup: "vanilla", minutes: 4 },
            { id: "two", setup: "vanilla", minutes: 6 },
            { id: "three", setup: "vanilla", minutes: 5 },
            { id: "four", setup: "gentleai", minutes: 5 },
            { id: "five", setup: "gentleai", minutes: 7 },
            { id: "six", setup: "gentleai", minutes: 6 },
            { id: "seven", setup: "cruzness", minutes: 6 },
            { id: "eight", setup: "cruzness", minutes: 8 },
            { id: "nine", setup: "cruzness", minutes: 7 },
          ],
        }),
      );
      const result = spawnSync(process.execPath, [script, runsPath, setupPath], {
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.deepEqual(report.tasks["ref-1"].vanilla, {
        runs: 3,
        successRate: 1 / 3,
        tokens: 30,
        steps: 10,
        durationSeconds: 10,
      });
      assert.deepEqual(report.tasks["ref-1"].gentleai, {
        runs: 3,
        successRate: 2 / 3,
        tokens: 21,
        steps: 8,
        durationSeconds: 7,
      });
      assert.deepEqual(report.tasks["ref-1"].cruzness, {
        runs: 3,
        successRate: 1,
        tokens: 18,
        steps: 20 / 3,
        durationSeconds: 6,
      });
      assert.deepEqual(report.tasks["ref-1"].vsVanilla.gentleai, {
        successRate: 1 / 3,
        tokens: -9,
        steps: -2,
        durationSeconds: -3,
      });
      assert.deepEqual(report.setup, {
        vanilla: { runs: 3, averageMinutes: 5 },
        gentleai: { runs: 3, averageMinutes: 6 },
        cruzness: { runs: 3, averageMinutes: 7 },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("compares a single task run across all three setups", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cruzness-metrics-"));
    try {
      const runsPath = join(dir, "runs.json");
      const base = { task: "ref-1", model: "model-x", promptHash: "abc" };
      await writeFile(
        runsPath,
        JSON.stringify([
          {
            ...base,
            setup: "vanilla",
            inputTokens: 10,
            outputTokens: 5,
            steps: 8,
            durationSeconds: 5,
            success: false,
          },
          {
            ...base,
            setup: "gentleai",
            inputTokens: 7,
            outputTokens: 4,
            steps: 6,
            durationSeconds: 4,
            success: true,
          },
          {
            ...base,
            setup: "cruzness",
            inputTokens: 6,
            outputTokens: 3,
            steps: 5,
            durationSeconds: 3,
            success: true,
          },
        ]),
      );
      const result = spawnSync(process.execPath, [script, runsPath], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.tasks["ref-1"].vanilla.successRate, 0);
      assert.equal(report.tasks["ref-1"].gentleai.successRate, 1);
      assert.deepEqual(report.tasks["ref-1"].vsVanilla.cruzness, {
        successRate: 1,
        tokens: -6,
        steps: -3,
        durationSeconds: -2,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects runs that do not use the same prompt", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cruzness-metrics-"));
    try {
      const runsPath = join(dir, "runs.json");
      const run = (setup, promptHash) => ({
        task: "ref-1",
        setup,
        model: "model-x",
        promptHash,
        inputTokens: 1,
        outputTokens: 1,
        steps: 1,
        durationSeconds: 1,
        success: true,
      });
      await writeFile(
        runsPath,
        JSON.stringify([
          run("vanilla", "abc"),
          run("gentleai", "different"),
          run("cruzness", "abc"),
        ]),
      );
      const result = spawnSync(process.execPath, [script, runsPath], { encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /same promptHash/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects different models or prompts across repetitions of a task", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cruzness-metrics-"));
    try {
      const runsPath = join(dir, "runs.json");
      const run = (setup, model, promptHash) => ({
        task: "ref-1",
        setup,
        model,
        promptHash,
        inputTokens: 1,
        outputTokens: 1,
        steps: 1,
        durationSeconds: 1,
        success: true,
      });
      await writeFile(
        runsPath,
        JSON.stringify([
          run("vanilla", "model-a", "prompt-a"),
          run("gentleai", "model-a", "prompt-a"),
          run("cruzness", "model-a", "prompt-a"),
          run("vanilla", "model-b", "prompt-b"),
          run("gentleai", "model-b", "prompt-b"),
          run("cruzness", "model-b", "prompt-b"),
        ]),
      );
      const result = spawnSync(process.execPath, [script, runsPath], { encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Task ref-1 must use the same model across repetitions/);

      await writeFile(
        runsPath,
        JSON.stringify([
          run("vanilla", "model-a", "prompt-a"),
          run("gentleai", "model-a", "prompt-a"),
          run("cruzness", "model-a", "prompt-a"),
          run("vanilla", "model-a", "prompt-b"),
          run("gentleai", "model-a", "prompt-b"),
          run("cruzness", "model-a", "prompt-b"),
        ]),
      );
      const promptResult = spawnSync(process.execPath, [script, runsPath], { encoding: "utf8" });
      assert.equal(promptResult.status, 1);
      assert.match(
        promptResult.stderr,
        /Task ref-1 must use the same promptHash across repetitions/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("times setup only from a clean clone and appends the elapsed minutes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cruzness-setup-"));
    const source = join(dir, "source");
    const repo = join(dir, "fresh-project");
    const state = join(dir, "timer.json");
    const results = join(dir, "setup-times.json");
    try {
      await mkdir(source);
      const git = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf8" });
      assert.equal(git(source, ["init", "-q"]).status, 0);
      assert.equal(git(source, ["config", "user.email", "metrics@example.invalid"]).status, 0);
      assert.equal(git(source, ["config", "user.name", "Metrics Test"]).status, 0);
      await writeFile(join(source, "README.md"), "fresh clone");
      assert.equal(git(source, ["add", "README.md"]).status, 0);
      assert.equal(git(source, ["commit", "-qm", "initial"]).status, 0);
      assert.equal(git(dir, ["clone", "-q", source, repo]).status, 0);

      await writeFile(join(repo, "leftover.txt"), "untracked");
      const dirtyStart = spawnSync(process.execPath, [setupTimer, "start", state, "cruzness"], {
        cwd: repo,
        encoding: "utf8",
      });
      assert.equal(dirtyStart.status, 1);
      assert.match(dirtyStart.stderr, /clean clone/);
      await rm(join(repo, "leftover.txt"));

      const start = spawnSync(process.execPath, [setupTimer, "start", state, "cruzness"], {
        cwd: repo,
        encoding: "utf8",
      });
      assert.equal(start.status, 0, start.stderr);
      await writeFile(join(repo, "opencode.json"), "{}");
      const stop = spawnSync(process.execPath, [setupTimer, "stop", state, results], {
        cwd: repo,
        encoding: "utf8",
      });
      assert.equal(stop.status, 0, stop.stderr);
      const timing = JSON.parse(await readFile(results, "utf8"));
      assert.equal(timing.runs.length, 1);
      assert.equal(timing.runs[0].setup, "cruzness");
      assert.ok(Number.isFinite(timing.runs[0].minutes) && timing.runs[0].minutes >= 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
