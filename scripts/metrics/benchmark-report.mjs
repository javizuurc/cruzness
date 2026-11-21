#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const setups = ["vanilla", "cruzness"];
const statuses = ["completed", "timeout", "runner-error", "invalid"];
const outcomes = ["passed", "failed", "unscored", ...statuses.slice(1)];
const baseFields = ["tokens", "steps", "durationSeconds"];
const optionalFields = ["toolErrors", "toolRetries", "sessionTreeTokens"];
const fields = [...baseFields, ...optionalFields];
const object = (x) => typeof x === "object" && x !== null && !Array.isArray(x);
const key = (x) => typeof x === "string" && /^[a-z0-9][a-z0-9_.-]*$/i.test(x);
const identity = (x) => typeof x === "string" && /^\S+$/.test(x);
const count = (x) => Number.isSafeInteger(x) && x >= 0;
const number = (x) => Number.isFinite(x) && x >= 0;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const mean = (values) => (values.length ? sum(values) / values.length : null);
const requireValid = (value, message) => {
  if (!value) throw new Error(message);
};

async function readExport(dir, name) {
  if (typeof name !== "string" || !name) return null;
  try {
    const value = JSON.parse(await readFile(resolve(dir, name), "utf8"));
    return Array.isArray(value?.messages) ? value : null;
  } catch {
    return null;
  }
}

function toolErrors(session) {
  if (!session) return null;
  const messages = session.messages.filter((message) => message?.type === "assistant");
  if (!messages.length || messages.some((message) => !Array.isArray(message.content))) return null;
  const tools = messages.flatMap(({ content }) => content.filter((part) => part?.type === "tool"));
  if (tools.some((part) => !["completed", "error"].includes(part.state?.status))) return null;
  return tools.filter((part) => part.state.status === "error").length;
}

function sessionUsage(session) {
  const id = session?.info?.id;
  const parent = session?.info?.parentID ?? null;
  if (!identity(id) || (parent !== null && !identity(parent))) return null;
  const assistants = session.messages.filter((message) => message?.type === "assistant");
  if (!assistants.length) return null;
  const values = assistants.flatMap(({ tokens }) => [
    tokens?.input,
    tokens?.output,
    tokens?.reasoning,
    tokens?.cache?.read,
    tokens?.cache?.write,
  ]);
  if (!values.every(count)) return null;
  const tokens = sum(values);
  return count(tokens) ? { id, parent, tokens } : null;
}

async function treeTokens(root, inventory, dir) {
  if (inventory?.complete !== true) return null;
  const base = sessionUsage(root);
  if (!base || base.parent !== null) return null;
  const nodes = new Map([[base.id, base]]);
  for (const name of inventory.children) {
    const child = sessionUsage(await readExport(dir, name));
    if (!child || child.id === base.id) return null;
    const existing = nodes.get(child.id);
    if (existing && (existing.parent !== child.parent || existing.tokens !== child.tokens))
      return null;
    nodes.set(child.id, child);
  }
  for (const node of nodes.values()) {
    const seen = new Set();
    let cursor = node;
    while (cursor?.id !== base.id) {
      if (!cursor || seen.has(cursor.id)) return null;
      seen.add(cursor.id);
      cursor = nodes.get(cursor.parent);
    }
  }
  const total = sum([...nodes.values()].map((node) => node.tokens));
  return count(total) ? total : null;
}

function score(criteria, values = {}) {
  requireValid(
    object(values) &&
      Object.entries(values).every(
        ([id, value]) => criteria.includes(id) && (value === null || typeof value === "boolean"),
      ),
    "Rubric must contain only declared criteria with boolean or null results",
  );
  const results = Object.fromEntries(
    criteria.map((id) => [id, Object.hasOwn(values, id) ? values[id] : null]),
  );
  const passed = Object.values(results).filter((value) => value === true).length;
  const failed = Object.values(results).filter((value) => value === false).length;
  return { results, passed, failed, unknown: criteria.length - passed - failed };
}

async function normalize(attempt, criteria, dir) {
  const { setup, repetition, status, verifiedCostUsd, observedToolRetries, sessionTree } = attempt;
  requireValid(
    setups.includes(setup) && count(repetition) && repetition > 0 && statuses.includes(status),
    "Each attempt needs a valid setup, positive repetition and status",
  );
  requireValid(verifiedCostUsd == null || number(verifiedCostUsd), "Invalid verifiedCostUsd");
  requireValid(
    observedToolRetries == null || count(observedToolRetries),
    "Invalid observedToolRetries",
  );
  requireValid(
    sessionTree == null ||
      (typeof sessionTree.complete === "boolean" &&
        Array.isArray(sessionTree.children) &&
        sessionTree.children.every(identity)),
    "sessionTree requires a completeness flag and child export paths",
  );
  const completed = status === "completed";
  const rubric = completed ? score(criteria, attempt.rubric) : null;
  const outcome = !rubric
    ? status
    : rubric.failed
      ? "failed"
      : rubric.unknown
        ? "unscored"
        : "passed";
  let measurements = null;
  if (completed && attempt.measurements != null) {
    const root = attempt.measurements;
    requireValid(
      object(root) && count(root.tokens) && count(root.steps) && number(root.durationSeconds),
      "Invalid measurements: expected tokens, steps and durationSeconds",
    );
    const session = await readExport(dir, attempt.sessionExport);
    measurements = {
      ...Object.fromEntries(baseFields.map((field) => [field, root[field]])),
      toolErrors: toolErrors(session),
      toolRetries: observedToolRetries ?? null,
      sessionTreeTokens: await treeTokens(session, sessionTree, dir),
    };
  }
  return {
    setup,
    repetition,
    outcome,
    rubric,
    measurements,
    verifiedCostUsd: verifiedCostUsd ?? null,
  };
}

function summarize(rows, criteria) {
  const totals = Object.fromEntries(
    outcomes.map((outcome) => [outcome, rows.filter((row) => row.outcome === outcome).length]),
  );
  const evaluated = rows.filter((row) => row.rubric);
  const cost = rows.map((row) => row.verifiedCostUsd);
  const denominator = totals.passed + totals.failed + totals.timeout;
  return {
    attempts: rows.length,
    measured: rows.filter((row) => row.measurements !== null).length,
    outcomes: totals,
    successRate: denominator ? totals.passed / denominator : null,
    criteria: Object.fromEntries(
      criteria.map((id) => {
        const passed = evaluated.filter((row) => row.rubric.results[id] === true).length;
        const failed = evaluated.filter((row) => row.rubric.results[id] === false).length;
        return [id, { passed, failed, unknown: evaluated.length - passed - failed }];
      }),
    ),
    costPerSuccessUsd:
      totals.passed && !totals.unscored && cost.every(number) && Number.isFinite(sum(cost))
        ? sum(cost) / totals.passed
        : null,
  };
}

function pair(rows) {
  const vanilla = new Map(
    rows.filter((row) => row.setup === "vanilla").map((row) => [row.repetition, row.measurements]),
  );
  return rows
    .filter((row) => row.setup === "cruzness" && row.measurements && vanilla.get(row.repetition))
    .sort((a, b) => a.repetition - b.repetition)
    .map(({ repetition, measurements }) => ({
      repetition,
      delta: Object.fromEntries(
        fields.map((field) => {
          const baseline = vanilla.get(repetition)[field];
          const candidate = measurements[field];
          return [field, baseline == null || candidate == null ? null : candidate - baseline];
        }),
      ),
    }));
}

try {
  requireValid(
    process.argv.length === 3,
    "Usage: node scripts/metrics/benchmark-report.mjs <attempts.json>",
  );
  const file = resolve(process.argv[2]);
  let input;
  try {
    input = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new Error("Could not read the benchmark attempt manifest as JSON");
  }
  requireValid(
    object(input?.criteria) && input.attempts?.length && Array.isArray(input.attempts),
    "Expected criteria and a non-empty attempts array",
  );
  const groups = new Map();
  for (const attempt of input.attempts) {
    const { task, model, promptHash } = attempt ?? {};
    const criteria = Object.hasOwn(input.criteria, task) ? input.criteria[task] : null;
    requireValid(
      key(task) &&
        Array.isArray(criteria) &&
        criteria.length &&
        criteria.every(key) &&
        new Set(criteria).size === criteria.length,
      "Invalid task or criteria",
    );
    requireValid(identity(model) && identity(promptHash), "Missing model or prompt hash");
    if (!groups.has(task))
      groups.set(task, { model, promptHash, criteria, rows: [], seen: new Set() });
    const group = groups.get(task);
    requireValid(
      group.model === model && group.promptHash === promptHash,
      "Mismatched model or prompt hash within a task",
    );
    const normalized = await normalize(attempt, criteria, dirname(file));
    const attemptKey = `${normalized.setup}:${normalized.repetition}`;
    requireValid(!group.seen.has(attemptKey), "Duplicate setup and repetition within a task");
    group.seen.add(attemptKey);
    group.rows.push(normalized);
  }
  const tasks = Object.fromEntries(
    [...groups].map(([task, { criteria, rows }]) => {
      const pairs = pair(rows);
      return [
        task,
        {
          attempts: rows,
          setups: Object.fromEntries(
            setups.map((setup) => [
              setup,
              summarize(
                rows.filter((row) => row.setup === setup),
                criteria,
              ),
            ]),
          ),
          pairs,
          paired: Object.fromEntries(
            fields.map((field) => {
              const values = pairs
                .map(({ delta }) => delta[field])
                .filter((value) => value !== null);
              return [field, { count: values.length, meanDelta: mean(values) }];
            }),
          ),
        },
      ];
    }),
  );
  console.log(JSON.stringify({ tasks }, null, 2));
} catch (error) {
  console.error(`Benchmark report failed: ${error.message}`);
  process.exitCode = 1;
}
