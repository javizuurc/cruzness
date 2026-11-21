# Report benchmark quality and reliability

Use the [standard benchmark](benchmark.md) to collect and score attempts. Then generate an evidence report without changing `runs.json` or the existing comparator:

```sh
node scripts/metrics/benchmark-report.mjs /scratch/attempts.json
```

## Prepare the attempt manifest

Keep this manifest and any exports outside the repository. Use the same task, model and exact prompt hash across repetitions of each task. Include **all attempts**, not just successful runs. The following is an illustrative manifest, not a live result:

```json
{
  "criteria": { "fix-import": ["compatible", "tests"] },
  "attempts": [
    {
      "task": "fix-import",
      "setup": "vanilla",
      "repetition": 1,
      "model": "provider/model",
      "promptHash": "sha256:example",
      "status": "completed",
      "measurements": { "tokens": 900, "steps": 16, "durationSeconds": 42 },
      "rubric": { "compatible": true, "tests": false },
      "sessionExport": "vanilla-1.json",
      "sessionTree": { "complete": true, "children": ["vanilla-child.json"] },
      "observedToolRetries": 2,
      "verifiedCostUsd": 0.01
    },
    {
      "task": "fix-import",
      "setup": "cruzness",
      "repetition": 1,
      "model": "provider/model",
      "promptHash": "sha256:example",
      "status": "timeout"
    }
  ]
}
```

- **Outcome:** use `completed` for sessions that finished, `timeout` if the model exceeded its time budget, `runner-error` for an execution error, and `invalid` for failed isolation or provenance. For a completed session, record each independently checked criterion as `true` or `false`. Omitted/`null` values mean unchecked. A known false criterion fails the task; success requires all true. Only completed attempts use rubric results and measurements.
- **Base measurements:** use the current importer to validate the root export. Copy `steps`, `durationSeconds` and `tokens` (`inputTokens + outputTokens`) to `measurements`. Omit the object if base measurements are unavailable.
- **Tools:** supply the root sanitized `sessionExport` to count observed tool failures. Any tool with an indeterminate terminal status makes the exact count unavailable. Set `observedToolRetries` only from independently recorded retry events in the root session; repeated tool names or a final export are not a retry log.
- **Session tree:** set `complete: true` only after independently enumerating every descendant for this root. Pass all child and nested child paths, relative to the manifest, or absolute paths. The reporter checks parent links and counts repeated IDs only once. A broken link, missing export or incomplete token counters gives `null`. Tree tokens sum input, output, reasoning and cache read/write from v2 exports; this is a different measure from root input + output. IDs and transcripts are not emitted.
- **Cost:** use `verifiedCostUsd` only with trustworthy USD billing or confirmed zero-cost usage attributed to each attempt, including failed attempts and descendants. The tool does not treat OpenCode's optional cost field as a verified price. If any attempt lacks reliable cost, any completed rubric is inconclusive, or no task passed, cost per success is unavailable.

## Interpret the result

The `attempts` list shows each outcome, criterion decision and measurement. `setups` separates timeouts, execution errors, invalid attempts, and unscored completions. Success rate is passes divided by passes + rubric failures + timeouts; report the excluded counts alongside it. Cost per success is total verified spend divided by passes, not spend on only the passing runs.

`pairs` records CruzNess minus vanilla for each repetition with both base measurements. `paired` contains the usable pair count and mean delta **for each metric**, so missing child, tool or retry evidence never becomes a zero. Do not report an improvement in speed or cost while ignoring a worse success rate.
