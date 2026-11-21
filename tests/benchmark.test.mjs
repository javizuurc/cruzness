import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cli = (script, ...args) =>
  spawnSync(
    process.execPath,
    [fileURLToPath(new URL(`../scripts/metrics/${script}.mjs`, import.meta.url)), ...args],
    { encoding: "utf8" },
  );

async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), "cruzness-benchmark-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return async (name, data) => {
    const file = join(dir, name);
    if (data !== undefined) await writeFile(file, JSON.stringify(data));
    return file;
  };
}

test("imports current exports, counts distinct child sessions, and omits the transcript", async (t) => {
  const file = await workspace(t);
  const model = { providerID: "opencode-go", id: "muse-spark-1.2-contributor" };
  const delegation = (tool, metadata, status = "completed") => ({
    type: "tool",
    tool,
    state: { status, metadata },
  });
  const messages = [
    { type: "user", time: { created: 1000 }, content: [{ type: "text", text: "private prompt" }] },
    {
      type: "assistant",
      model,
      time: { completed: 1800 },
      tokens: { input: 12, output: 3 },
      content: [delegation("task", { sessionId: "ses_child" }), delegation("read", {})],
    },
    {
      type: "assistant",
      model,
      time: { completed: 2500 },
      tokens: { input: 20, output: 4 },
      content: [
        delegation("subagent", { sessionID: "ses_child" }),
        delegation("subagent", { sessionID: "ses_second" }),
      ],
    },
  ];
  const input = await file("export.json", { messages });
  const output = await file("runs.json");
  const args = ["--task", "import", "--prompt-hash", "sha256:example", "--setup", "cruzness"];
  const result = cli("metrics-import", input, output, ...args, "--success", "true");
  assert.equal(result.status, 0, result.stderr);
  const [record] = JSON.parse(await readFile(output, "utf8"));
  assert.deepEqual(record, {
    task: "import",
    setup: "cruzness",
    model: "opencode-go/muse-spark-1.2-contributor",
    promptHash: "sha256:example",
    inputTokens: 32,
    outputTokens: 7,
    steps: 6,
    durationSeconds: 1.5,
    success: true,
    assistantTurns: 2,
    toolCalls: 4,
    delegationCalls: 3,
    subagents: 2,
  });

  messages.at(-1).content.push(delegation("task", {}, "error"));
  await file("export.json", { messages });
  const unknown = cli("metrics-import", input, output, ...args, "--success", "false");
  assert.equal(unknown.status, 0, unknown.stderr);
  const records = JSON.parse(await readFile(output, "utf8"));
  assert.equal(records.length, 2);
  assert.equal(records[1].delegationCalls, 4);
  assert.equal(records[1].subagents, null);
  assert.equal(records[1].success, false);

  messages.at(-1).content.at(-1).state.metadata.sessionID = "ses_ ";
  await file("export.json", { messages });
  const malformed = cli("metrics-import", input, output, ...args, "--success", "false");
  assert.equal(malformed.status, 0, malformed.stderr);
  const saved = JSON.parse(await readFile(output, "utf8"));
  assert.equal(saved[2].delegationCalls, 4);
  assert.equal(saved[2].subagents, null);

  delete messages.at(-1).tokens.input;
  await file("export.json", { messages });
  const invalid = cli("metrics-import", input, output, ...args, "--success", "false");
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /tokens\.input/);
  assert.deepEqual(JSON.parse(await readFile(output, "utf8")), saved);
});

test("keeps dash-prefixed positional setup-time filenames valid", async (t) => {
  const file = await workspace(t);
  await file("--timing.json", { runs: [{ setup: "vanilla", minutes: 2 }] });
  const input = await file(
    "runs.json",
    ["vanilla", "gentleai", "cruzness"].map((setup) => ({
      setup,
      task: "legacy",
      model: "provider/model",
      promptHash: "same",
      success: true,
      inputTokens: 1,
      outputTokens: 0,
      steps: 1,
      durationSeconds: 0,
    })),
  );
  const script = fileURLToPath(new URL("../scripts/metrics/metrics.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "runs.json", "--timing.json"], {
    cwd: join(input, ".."),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout).setup.vanilla, { runs: 1, averageMinutes: 2 });
});

test("compares vanilla and CruzNess across tasks without treating unmeasured subagents as zero", async (t) => {
  const file = await workspace(t);
  const run = (task, setup, inputTokens, subagents) => ({
    task,
    setup,
    model: "opencode-go/muse-spark-1.2-contributor",
    promptHash: `sha256:${task}`,
    inputTokens,
    outputTokens: 5,
    steps: 4,
    durationSeconds: 10,
    success: true,
    assistantTurns: 2,
    toolCalls: 2,
    delegationCalls: subagents === 0 ? 0 : 1,
    subagents,
  });
  const runs = [
    run("explain", "vanilla", 15, 0),
    run("explain", "cruzness", 5, 1),
    run("fix", "vanilla", 20, null),
    run("fix", "cruzness", 10, 0),
  ];
  const input = await file("runs.json", runs);
  const timing = await file("setup.json", {
    runs: [
      { setup: "vanilla", minutes: 2 },
      { setup: "gentleai", minutes: 3 },
    ],
  });
  const result = cli("metrics", input, timing, "--setups", "vanilla,cruzness");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(report.tasks), ["explain", "fix"]);
  assert.deepEqual(Object.keys(report.setup), ["vanilla", "cruzness"]);
  assert.deepEqual(Object.keys(report.tasks.explain), ["vanilla", "cruzness", "vsVanilla"]);
  assert.deepEqual(report.tasks.explain.vsVanilla.cruzness, {
    successRate: 0,
    tokens: -10,
    steps: 0,
    durationSeconds: 0,
    assistantTurns: 0,
    toolCalls: 0,
    delegationCalls: 1,
    subagents: 1,
  });
  assert.equal(report.tasks.fix.vanilla.subagents, null);
  assert.equal(report.tasks.fix.cruzness.subagents, 0);
  assert.equal(report.tasks.fix.vsVanilla.cruzness.subagents, null);

  for (const selection of ["vanilla,unknown", "vanilla,vanilla", "vanilla,,cruzness", "cruzness"]) {
    const invalid = cli("metrics", input, "--setups", selection);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /--setups/);
  }
  runs[1].promptHash = "not-paired";
  await file("runs.json", runs);
  const unpaired = cli("metrics", input, "--setups", "vanilla,cruzness");
  assert.equal(unpaired.status, 1);
  assert.match(unpaired.stderr, /same promptHash/);
});
