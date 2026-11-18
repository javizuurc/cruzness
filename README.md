# CruzNess

CruzNess is an AI harness baseline built on **opencode** as the main infrastructure. Copy it into any project to get a ready-to-use AI development setup focused on saving tokens.

> Status: early stage. v1 is opencode config + base agents only. Scope: [PRD](PRD.md).

## Why CruzNess?

AI coding assistants waste tokens when every project re-invents its harness. CruzNess ships one copyable baseline so you bring the harness instead of rebuilding it. Details: [PRD 1.1](PRD.md#11-problem-statement).

## What you get (v1)

- Copyable baseline for any project.
- Base config that loads in opencode without manual fixes.
- Base agents for common development tasks.

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

Structure and data flow: [ARCHITECTURE](ARCHITECTURE.md).

## Configuration

v1 has no profiles. Copy the baseline as-is.

## Vision

Future ideal, not v1. Owner: [ARCHITECTURE 05](ARCHITECTURE.md#05-scalability--future-considerations).

## Contributing

Early project: open an issue first to discuss any change.

## License

To be decided.

## Acknowledgements

Built on [opencode](https://github.com/sst/opencode).
