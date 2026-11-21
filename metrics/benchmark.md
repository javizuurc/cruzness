# Compare CruzNess with OpenCode vanilla

Run `npm test` for deterministic, offline checks. The original live matrix is three tasks × three repetitions × two setups = **18 sessions**. The [follow-up suite](benchmark-follow-up.md) adds four different task types without changing that matrix. Do not publish fixture values or an incomplete run as live results.

## Run and score the benchmark

1. Freeze one baseline commit or source archive before either setup runs. Record its identity, OpenCode version, model ID, and config for both setups. The original tasks below need the metrics baseline **before** current-export support and `--setups`; check both failures before starting. Use the same task material in both setups.
2. Start each session in a fresh copy outside the primary repository, with its own writable dependencies and no writable links back to the repository. Use stock OpenCode without CruzNess or other global harness instructions for vanilla. For CruzNess, enable the project harness. Keep the model, prompt, permissions and budgets fixed; vary which setup runs first across repetitions.
3. With OpenCode v2 on Windows, use `--standalone` and set both the process working directory and `PWD` to the copy. Use a no-edit probe first. Verify that the session's actual project directory (local, unsanitized metadata) equals the designated copy. Discard misbound runs and do not retain unsanitized exports.
4. Export each session with `opencode session export <session-id> --sanitize`. Independently score the answer, tests and file changes. Reject any media change or edit outside the task's allowlist. Verify the primary worktree and index were not modified. Keep raw results and copies outside Git.
5. Import each accepted measurement using the [README commands](../README.md#success-metrics), replacing `--task`, `--setup`, `--prompt-hash`, and `--success`. Hash the exact prompt bytes. Use `--success false` for correctly measured runs that fail their task; do not import runs with an invalid directory or missing required measurements. Append records in the same task and repetition order per setup. Publish the per-run table, per-task averages, sample sizes, failed checks and exclusions.

## Tasks and acceptance

### Explain the pipeline (`metrics-pipeline-explanation`)

> In this repository, explain the data flow from importing one OpenCode session export to comparing metrics. Cite the relevant files and describe the fields that determine tokens, steps, duration, setup, and success. Do not edit files or contact external services.

Pass only if the answer identifies: importer validation and transcript exclusion; run identity (`task`, `setup`, model and prompt hash) and measured fields; steps and elapsed-time rules; pairing, grouping, averages and deltas; separate setup time; and the frozen importer's lack of support for current sanitized exports. No file changes.

### Fix the importer (`metrics-import-current-export`)

> Read Task 2's reproduction and acceptance checks in `metrics/tasks.md`. Fix the metrics importer so it can import the current sanitized OpenCode session export format as well as the legacy format it already supports. Preserve the existing run-record schema and do not store prompt or transcript text. Add a regression test for the current format, keep the legacy test passing, and run the metrics test suite. Do not contact external services, edit images or other media, stage files, or commit.

Prepare `metrics/tasks.md` in the scratch baseline with the shared task material (copy this section and the next one under Task 2 and Task 3). On the original baseline, a current export with `messages[].type` reports `OpenCode export has no assistant messages`. A `user` created at 1000 ms and two `assistant` messages with `(12, 3)` and `(20, 4)` input/output tokens, one `content` tool part, and final completion at 2500 ms must import as 32 input tokens, 7 output tokens, 3 steps and 1.5 seconds. Use model `opencode-go/muse-spark-1.2-contributor`. Require the unchanged record fields, no transcript text, a regression test that fails on the baseline, legacy coverage and a green `npm test`. Only the importer and its metrics tests may change.

### Compare two setups (`metrics-compare-selected-setups`)

> Read Task 3's acceptance checks in `metrics/tasks.md`. Add an optional `--setups <comma-separated-setups>` option to `scripts/metrics/metrics.mjs` so I can compare vanilla with CruzNess without providing GentleAI runs. Keep the existing all-three-setups behavior as the default. Validate the selected setups and paired runs, report only selected setups, and compute each selected non-vanilla setup's delta against vanilla. Update the CLI usage and README example, add tests, and run `npm test`. Do not contact external services, edit images or other media, stage files, or commit.

Pass if the two-setup command accepts paired input and reports only those two setups (also in setup times, if supplied) and only CruzNess under `vsVanilla`. Unknown, duplicate and malformed choices must fail. Omitting the option must retain the three-setup default and validation. Require CLI help, a README example, tests and a green `npm test`. Only the comparator, its metrics tests and README may change.

## Read the metrics

| Metric           | Measurement                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Total tokens     | Sum of reported input + output tokens in the exported session. Does not estimate costs or add child-session usage.                                                                         |
| Steps            | Assistant messages + explicit tool calls in the export. The current format also reports these separately.                                                                                  |
| Duration         | Seconds from the first user message to final assistant completion. Includes model and tool latency; excludes setup time.                                                                   |
| Delegation calls | `task` and `subagent` tool calls in the current-format export, including attempts without a visible child ID.                                                                              |
| Subagents        | Distinct direct child session IDs reported by those calls. Reuse counts once; nested children are not measured. If a call lacks a usable ID, this value is unavailable (`null`), not zero. |
| Success          | Percentage that passes the task rubric, independently of the session or test command exit status.                                                                                          |

Legacy exports retain the original record shape. An average for an optional count is `null` if any repetition in that setup lacks the measurement; the delta is then also unavailable. Deltas are **CruzNess minus vanilla**. The aggregate report does not establish a speedup outside the measured tasks and sample.

Use the [evidence report](benchmark-evidence.md) to include timeouts, per-criterion scores, tool errors and retries, verified cost per success, whole-session-tree tokens, and paired sample sizes.

## Observed evidence so far

An earlier preliminary pipeline-explanation trial in this project's development session reported the following. The table is transcribed from that session's six-run summary; the source exports are not included, so this is historical context, not independently reproducible evidence. It is **not** part of the isolated 18-session suite. Child sessions were not measured in that trial.

| Setup    | Runs | Mean tokens | Mean steps | Mean seconds | Success |
| -------- | ---: | ----------: | ---------: | -----------: | ------: |
| Vanilla  |    3 |      48,459 |      78.33 |       88.939 |     3/3 |
| CruzNess |    3 |   31,486.33 |         51 |       46.149 |     3/3 |

Do not count diagnostic importer runs whose exports were bound to the primary project. There is no verified result for the full isolated matrix yet.
