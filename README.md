# CruzNess

CruzNess is an AI harness baseline built on **opencode** as the main infrastructure. Copy it into any project to get a ready-to-use AI development setup focused on saving tokens.

> Status: early stage. The baseline includes OpenCode config, base agents, and project preferences in `cruzness.yml`. Scope: [PRD](PRD.md).

## Why CruzNess?

AI coding assistants waste tokens when every project re-invents its harness. CruzNess ships one copyable baseline so you bring the harness instead of rebuilding it. Details: [PRD 1.1](PRD.md#11-problem-statement).

## What you get

- Copyable baseline for any project.
- Base config that loads in opencode without manual fixes.
- Base agents for common development tasks.
- `cruzness.yml` for project-level CruzNess preferences.

Acceptance criteria: [PRD FR-001..FR-003](PRD.md#21-functional-requirements).

## Use it

Requirements:

- `git`
- `opencode` installed and working

```sh
git clone <cruzness-repo-url>
# install opencode per its official docs
# copy the cruzness baseline into your project
```

Then open your project with opencode and the baseline applies.

## Success metrics

Run `npm test` for the offline CruzNess suite. For the live comparison, run the same tasks under OpenCode vanilla and CruzNess. See the [benchmark guide](metrics/benchmark.md) for task prompts, scoring, isolation checks, and observed results.

From a scratch directory, import each sanitized export into a shared run file and compare the paired setups:

```sh
opencode session export <session-id> --sanitize > session.json
node <cruzness-path>/scripts/metrics/metrics-import.mjs session.json runs.json --task fix-bug --prompt-hash sha256:replace-with-same-prompt-hash --setup cruzness --success true
node <cruzness-path>/scripts/metrics/metrics.mjs runs.json --setups vanilla,cruzness
```

Omit `--setups` for the original vanilla/GentleAI/CruzNess report. To include optional setup times, pass `setup-times.json` before `--setups`. For setup time, start from a clean project clone, copy the baseline and verify it loads before stopping. Keep state/result files outside the project and use a new state file per clone:

```sh
node <cruzness-path>/scripts/metrics/setup-timer.mjs start <state.json> cruzness
# copy the baseline and verify it loads
node <cruzness-path>/scripts/metrics/setup-timer.mjs stop <state.json> setup-times.json
```

The timer records which setup was measured and requires the same project root and commit when stopped.

Structure and data flow: [ARCHITECTURE](ARCHITECTURE.md).

## Configuration

`cruzness.yml` holds project-level CruzNess preferences. Set `notifications.task_complete` to `true` to express a preference for a notification when a task completes, or `false` to opt out:

```yaml
notifications:
  task_complete: false
```

OpenCode Desktop may show its own session notifications independently; it controls delivery through its app and operating-system settings. `cruzness.yml` is CruzNess's preference file, not an OpenCode configuration file.

## Vision

Additional project-specific modules and integrations remain future work. Owner: [ARCHITECTURE 05](ARCHITECTURE.md#05-scalability--future-considerations).

## Contributing

Early project: open an issue first to discuss any change.

## License

To be decided.

## Acknowledgements

Built on [opencode](https://github.com/sst/opencode).
