# Follow-up benchmark: broaden task coverage

Run these four tasks independently of the [original three](benchmark.md#tasks-and-acceptance). The follow-up adds **24 sessions** at three repetitions per setup. Together the suites cover seven tasks and 42 scheduled sessions, but use different frozen baselines and should be reported separately.

## Freeze the follow-up before running it

- Use one clean commit or immutable archive containing the current importer and `--setups` support. Confirm that `npm test` passes, the new timer tests and troubleshooting section are not already present, and `--task` is not implemented.
- Copy this file into that snapshot at `metrics/benchmark-follow-up.md`. Run the quoted prompts verbatim, from a fresh copy for every attempt. Apply the same model, tools, permissions, timeout and stopping rules to both setups. Alternate which setup runs first per repetition. Delegation is optional, never required for a pass.
- For test-only and implementation tasks, authorise tool use and a disposable Git fixture only inside the benchmark scratch area. Independently run the required checks rather than trusting the agent's report. Keep any reports, fixtures and transcripts out of Git. No edits outside each task's allowlist and no media changes.

## Task 4 — Add regression coverage for the setup timer

**ID:** `setup-timer-regression-coverage` · **Type:** tests only

> Read Task 4 in `metrics/benchmark-follow-up.md`. Add public CLI regression tests proving that the setup timer rejects a stop from a different project and that a repeated stop in the right project does not duplicate its result. Do not change production code or existing tests. Run npm test. Do not contact external services, change media, stage files, or commit outside disposable Git fixtures used by tests.

Pass only if:

- Only `tests/metrics.test.mjs` changes, and existing tests still pass.
- Two scratch repositories start at the same commit. After `start` in the first, `stop` from the second exits `1` with the same-project-and-commit error and leaves both the timer state and a pre-existing results file byte-identical. Sharing the commit isolates the project identity check.
- Two successful stops from the first repository return the same `setupMinutes`; the results contain exactly one record for the timer ID with the expected setup. The tests call the CLI, not an internal helper.

## Task 5 — Write troubleshooting instructions

**ID:** `metrics-troubleshooting-docs` · **Type:** documentation only

> Read Task 5 in `metrics/benchmark-follow-up.md`. Add a concise troubleshooting section to the README for the vanilla versus CruzNess metrics workflow. Use the actual CLIs as the source of truth. Do not change code or tests, contact external services, change media, stage files, or commit.

Pass only if:

- Only `README.md` changes. The new section provides a diagnosis and a concrete corrective action for four problems: missing token/timestamp fields in a session export, selecting the wrong setup set, mismatched task/model/prompt hash, and timer state placed inside the project.
- It includes valid examples of `--setups vanilla,cruzness` and an external timer state path. It warns against editing identity fields to force pairing, and explains that `null` subagents means unavailable, not zero.
- Each suggested action matches the frozen CLI; no new options or unsupported commands are presented as available.

## Task 6 — Audit benchmark evidence across components

**ID:** `benchmark-evidence-audit` · **Type:** cross-file investigation, read-only

> Read Task 6 in `metrics/benchmark-follow-up.md`. Audit what the importer, comparator, setup timer and documented benchmark each verify. Explain how a report can look valid even when run pairing, subagent counts or isolation evidence are incomplete. Cite file and line references and recommend what to check before using the report. Do not edit files or contact external services.

Pass only if the answer cites the relevant source or protocol for all four points:

1. Ordered pairing checks task, model and prompt hash but does not independently verify the repetition ID or frozen baseline.
2. Subagents count distinct visible direct children; `null` means unavailable and propagates to an affected setup mean and delta. Main-session tokens do not include child-session usage.
3. Setup timing checks project and commit separately; its state does not establish the provenance or isolation of task runs.
4. An independent reviewer must verify session directory, unchanged primary checkout, allowed file changes and rubric success. Invalid measurements, failed tasks and unknown measurements are distinct.

Any file edit fails the task.

## Task 7 — Filter the comparison to one task

**ID:** `metrics-filter-one-task` · **Type:** feature across CLI, tests and docs

> Read Task 7 in `metrics/benchmark-follow-up.md`. Add an optional `--task <id>` filter to the metrics comparison CLI, combinable with `--setups vanilla,cruzness`. Keep the existing output when the filter is omitted. Update usage, README and tests, and run npm test. Do not contact external services, change media, stage files, or commit.

Pass only if:

- `node scripts/metrics/metrics.mjs runs.json --setups vanilla,cruzness --task beta` reports only `beta` from a file containing valid pairs for `alpha` and `beta`. Its `beta` summary and delta equal the unfiltered report's `beta` entry. Optional setup timing remains unchanged.
- A nonexistent task exits `1` with a useful error. A task with mismatched model or prompt hash still exits `1`; the filter must not bypass validation. Without `--task`, otherwise valid legacy invocations keep their previous output.
- Usage, README and public CLI tests cover the new option, `npm test` passes, and only `scripts/metrics/metrics.mjs`, metrics test files and `README.md` change.

## Interpret the comparison

Report each attempt, including timeouts and rubric failures. For every task and setup, show the success count, number of usable measurements, tokens, steps, elapsed time, delegation calls and direct subagents. Calculate paired deltas only for repetitions with usable measurements on both sides, and show the number of pairs. Keep timeout counts visible even when those attempts have no usable token or step count.

Treat success as a guardrail: do not call fewer tokens or seconds an improvement on a task with a lower pass rate. More task types improve coverage, not precision within one task. If the goal is a more stable estimate for a specific task, plan additional paired repetitions for both setups before inspecting their results. Do not claim a general speedup from three pairs.
