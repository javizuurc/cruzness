# CruzNess

CruzNess is an AI harness baseline built on **opencode** as the main infrastructure. Copy it into any project to get a ready-to-use AI development setup focused on saving tokens.

> Status: early stage. The baseline includes OpenCode config, base agents, and project preferences in `cruzness.yml`. Scope: [PRD](PRD.md).

## Why CruzNess?

AI coding assistants waste tokens when every project re-invents its harness. CruzNess ships one copyable baseline so you bring the harness instead of rebuilding it. Details: [PRD 1.1](PRD.md#11-problem-statement).

## What you get

- Copyable baseline for any project.
- Auto-discovered harness plugins; no project plugin list to maintain.
- Context Mode and Ponytail installed as harness dependencies.
- MCP servers configured and distributed by the CruzNess plugin.
- Base agents for common development tasks.
- Local OpenCode plugin for project notification preferences.
- `cruzness.yml` for project-level CruzNess preferences.

Acceptance criteria: [PRD FR-001..FR-004](PRD.md#21-functional-requirements).

## Use it

Requirements:

- `git`
- `opencode` installed and working
- `node` 24.15+ and `npm`

```sh
git clone <cruzness-repo-url>
# install opencode per its official docs
# copy the cruzness baseline into your project
cp cruzness.yml.example cruzness.yml
npm install
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

`cruzness.yml` holds project-level CruzNess preferences. It is ignored by Git; start by copying `cruzness.yml.example`. Set `notifications.task_complete` to `true` to receive a system notification after a successful task in the OpenCode TUI, or `false` to opt out:

```yaml
notifications:
  task_complete: true
```

The local CruzNess OpenCode plugin reads this file and listens for task completion. Notifications appear when the TUI is blurred, subject to operating-system notification settings. OpenCode Desktop's own notifications remain independently controlled by its app and operating-system settings.

The plugin also registers CruzNess's MCP servers, so projects only need to load the plugin; server definitions stay with the harness.
The GitHub MCP reads `GITHUB_PERSONAL_ACCESS_TOKEN` from the OpenCode process environment and remains disabled when it is unset.

## Vision

Additional project-specific modules and integrations remain future work. Owner: [ARCHITECTURE 05](ARCHITECTURE.md#05-scalability--future-considerations).

## Contributing

Early project: open an issue first to discuss any change.

## License

To be decided.

## Acknowledgements

Built on [opencode](https://github.com/sst/opencode).
