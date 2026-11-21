import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../scripts/metrics/benchmark-report.mjs", import.meta.url));
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "benchmark-evidence-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const save = async (name, value) => {
    await writeFile(join(dir, name), JSON.stringify(value));
    return name;
  };
  const report = async (value) => {
    await save("attempts.json", value);
    return spawnSync(process.execPath, [cli, "attempts.json"], { cwd: dir, encoding: "utf8" });
  };
  return { save, report };
}

const attempt = (setup, repetition, props = {}) => ({
  task: "fix",
  setup,
  repetition,
  model: "provider/model",
  promptHash: "sha256:example",
  status: "completed",
  measurements: { tokens: 40, steps: 4, durationSeconds: 10 },
  rubric: { behavior: true, tests: true },
  ...props,
});
const manifest = (...attempts) => ({ criteria: { fix: ["behavior", "tests"] }, attempts });

test("records acceptance per criterion and reports unmeasured outcomes without pairing them", async (t) => {
  const { report } = await fixture(t);
  const input = manifest(
    attempt("vanilla", 1, { verifiedCostUsd: 0.3 }),
    attempt("cruzness", 1, {
      rubric: { behavior: false },
      measurements: { tokens: 30, steps: 3, durationSeconds: 8 },
      verifiedCostUsd: 0.1,
    }),
    attempt("vanilla", 2, { status: "timeout", verifiedCostUsd: 0.2 }),
    attempt("cruzness", 2, { verifiedCostUsd: 0.3 }),
    attempt("vanilla", 3, { status: "runner-error", verifiedCostUsd: 0 }),
    attempt("cruzness", 3, { status: "invalid" }),
    attempt("vanilla", 4, { rubric: { behavior: true }, verifiedCostUsd: 0 }),
  );
  const result = await report(input);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const { tasks } = JSON.parse(result.stdout);
  const { attempts, setups, pairs, paired } = tasks.fix;
  assert.deepEqual(attempts[1].rubric, {
    results: { behavior: false, tests: null },
    passed: 0,
    failed: 1,
    unknown: 1,
  });
  assert.deepEqual(setups.vanilla.outcomes, {
    passed: 1,
    failed: 0,
    unscored: 1,
    timeout: 1,
    "runner-error": 1,
    invalid: 0,
  });
  assert.deepEqual(setups.cruzness.criteria.tests, { passed: 1, failed: 0, unknown: 1 });
  assert.equal(
    setups.vanilla.costPerSuccessUsd,
    null,
    "unknown rubric would distort the denominator",
  );
  assert.equal(setups.cruzness.costPerSuccessUsd, null, "invalid attempt has no verified cost");
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].repetition, 1);
  assert.equal(pairs[0].delta.durationSeconds, -2);
  assert.deepEqual(paired.durationSeconds, { count: 1, meanDelta: -2 });
  assert.deepEqual(paired.sessionTreeTokens, { count: 0, meanDelta: null });
  assert.equal(attempts[2].measurements, null);
  assert.equal(attempts[2].rubric, null);

  input.attempts.pop();
  input.attempts.at(-1).verifiedCostUsd = 0.1;
  const priced = JSON.parse((await report(input)).stdout).tasks.fix.setups;
  assert.equal(priced.vanilla.costPerSuccessUsd, 0.5);
  assert.equal(priced.cruzness.costPerSuccessUsd, 0.5);
});

test("counts failed tools, trusts only observed retries and deduplicates a complete nested export tree", async (t) => {
  const { save, report } = await fixture(t);
  const session = (id, parentID, input, content = []) => ({
    info: { id, parentID },
    messages: [
      {
        type: "assistant",
        cost: 0,
        tokens: { input, output: 3, reasoning: 2, cache: { read: 5, write: 1 } },
        content,
      },
    ],
  });
  const root = await save(
    "root.json",
    session("ses_root", undefined, 10, [
      { type: "tool", name: "read", state: { status: "error", error: "secret error text" } },
      { type: "tool", name: "read", state: { status: "completed" } },
      { type: "tool", name: "subagent", state: { status: "completed" } },
    ]),
  );
  const child = await save("child.json", session("ses_child", "ses_root", 8));
  const leaf = await save("leaf.json", session("ses_leaf", "ses_child", 1));
  const input = manifest(
    attempt("vanilla", 1, {
      sessionExport: root,
      sessionTree: { complete: true, children: [child, leaf, child] },
      observedToolRetries: 1,
    }),
    attempt("cruzness", 1, {
      sessionExport: root,
      sessionTree: { complete: false, children: [child] },
    }),
    attempt("vanilla", 2, {
      sessionExport: root,
      sessionTree: { complete: true, children: [leaf] },
    }),
  );
  const result = await report(input);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /secret error text|ses_root|ses_leaf|root\.json/);
  const { attempts, setups } = JSON.parse(result.stdout).tasks.fix;
  assert.deepEqual(
    attempts.map((r) => r.measurements.toolErrors),
    [1, 1, 1],
  );
  assert.deepEqual(
    attempts.map((r) => r.measurements.toolRetries),
    [1, null, null],
  );
  assert.deepEqual(
    attempts.map((r) => r.measurements.sessionTreeTokens),
    [52, null, null],
  );
  assert.equal(setups.vanilla.costPerSuccessUsd, null, "unverified export cost is ignored");
});

test("rejects duplicate attempts and conflicting pairing identity", async (t) => {
  const { report } = await fixture(t);
  for (const [records, error] of [
    [[attempt("vanilla", 1), attempt("vanilla", 1)], /duplicate/i],
    [[attempt("vanilla", 1), attempt("cruzness", 1, { model: "other/model" })], /model or prompt/i],
  ]) {
    const result = await report(manifest(...records));
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, error);
  }
});
