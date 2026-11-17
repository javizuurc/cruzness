# CruzNess

CruzNess is an AI harness baseline built on **opencode** as the main infrastructure. Copy it into any project to get a ready-to-use AI development setup focused on saving tokens.

> Status: early stage. The baseline (MCPs, skills, plugins, hooks, custom agents) is being defined.

## Why CruzNess?

AI coding assistants waste tokens when every project re-invents its harness: same prompts, same MCP wiring, same agents, same conventions.

CruzNess aims to fix that with one copyable baseline:

- Reuse instead of rewire: bring the harness, don't rebuild it.
- Token efficiency: purpose-built skills, agents and hooks over generic chat.
- Consistency: same way of working across projects.

## Features

- **Copyable baseline** for any project.
- **Custom agents** tuned for common development tasks.
- **Skills and plugins** for repetitive workflows.
- **Hooks** to automate harness behaviour.
- **MCP-based context**: project memory and fresh docs without pasting blobs into chat.

## Architecture

opencode is the AI IDE; everything else plugs into it:

```text
project/
└── cruzness baseline/
    ├── opencode (ADE / runtime)
    ├── skills + plugins (reusable workflows)
    ├── custom agents (task specialists)
    ├── hooks (automation)
    └── MCPs (context providers, e.g. memory, docs)
```

- **opencode**: executes the harness, owns agents, skills, hooks and MCP wiring.
- **Skills / plugins**: reusable procedures the agent follows instead of improvising.
- **Custom agents**: bounded specialists (explore, implement, verify).
- **Hooks**: event-driven automation around the workflow.
- **MCPs**: external context on demand (memory, documentation).

## Integrations

CruzNess runs on [opencode](https://github.com/sst/opencode) as its ADE: it provides the agent runtime, skills, custom agents, hooks and MCP wiring that the baseline reuses in every project.

| Tool | Role |
|------|------|
| opencode | ADE and harness runtime. Executes agents, skills, hooks and MCPs. |

## Installation

Requirements:

- `git`
- `opencode` installed and working

First steps:

```sh
git clone <cruzness-repo-url>
# install opencode per its official docs
# copy the cruzness baseline into your project
```

Then open your project with opencode and the baseline applies.

## Configuration

Customization via opencode profiles and project-local overrides (exact profiles to be defined as the baseline lands).

## Roadmap

No roadmap yet.

## Contributing

Early project: open an issue first to discuss any change.

## License

To be decided.

## Acknowledgements

Built on [opencode](https://github.com/sst/opencode).
