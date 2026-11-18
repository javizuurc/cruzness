# ARCHITECTURE.md

> Big picture. Clear structure. Scalable.

# Architecture

High-level overview of the project structure, tech stack, and how everything connects.

## 01 System Overview

A visual view of how the baseline works and the main pieces involved.

```text
Developer
  (clone + copy)
    |
    v
Target project + CruzNess baseline
    |
    v
opencode (ADE / runtime)
  |-- base config (loads without manual fixes)
  |-- base agents (invokable specialists)
    |
    v
Task execution (fewer steps, fewer tokens)
```

Responses: agent output + file changes in the target project.

- **Developer**: clones CruzNess, copies the baseline into any project.
- **opencode**: executes the harness, owns config, agents and wiring.
- **Baseline**: base config + base agents only in v1 ([FR-002, FR-003](PRD.md#21-functional-requirements)).
- **Target project**: where the work happens; baseline adds no runtime dependency.

## 02 Tech Stack

Tools and technologies used in the project.

- **ADE / Runtime**: opencode (only supported runtime in v1)
- **Baseline code**: TypeScript, aligned with opencode's stack
- **Package manager**: bun, if feasible ([TBD per PRD](PRD.md#3-constraints))

Out of v1 (decided in [PRD 1.4](PRD.md#14-non-goals)):  profiles/advanced customization, automatic token measurement, multi-IDE support.

## 03 Project Structure

A simplified view of the folder structure.

```text
./
  ARCHITECTURE.md   # this overview
  PRD.md            # v1 scope FR-001..FR-003
  README.md         # clone + copy usage (FR-001)
  opencode.json     # base config, loads cleanly (FR-002)
  agents/           # base agents, one line purpose each (FR-003)
  # vision only, no file yet:
  # cruzness.yml    # per-project modules (e.g. frontend)
```

- [`README.md`](README.md): how to clone and copy the baseline ([FR-001](PRD.md#21-functional-requirements)).
- [`PRD.md`](PRD.md): frozen v1 scope and acceptance criteria.
- `ARCHITECTURE.md`: this overview, kept in sync with the two above.
- `opencode.json` + `agents/`: the only v1 runtime contract.

## 04 Data Flow

CruzNess has no runtime of its own. Execution behaviour belongs to opencode; this flow only shows where the baseline plugs in.

1. Developer clones the repo and copies the baseline into the target project.
2. Target is opened with opencode; shipped config loads.
3. Developer invokes a base agent for the task.
4. opencode executes (tools, model loop) — not detailed here, see opencode docs.
5. Reference task is compared before/after to verify token saving ([metrics](PRD.md#4-success-metrics)).

## 05 Scalability & Future Considerations

Key areas to consider as the product grows.

- Keep v1 to config + agents; defer skills/MCPs explicitly to avoid scope creep.
- Watch total MCPs/tools per agent to avoid context bloat and atrophy (no fixed budget yet, to be measured).
- Vision (beyond v1): per-project YAML to enable integrations (e.g. frontend module bringing SEO + frontend specialist agents with their tools), settable per project. No schema frozen yet.
- Define one reference task and record before/after tokens before claiming savings.
- Pin the supported opencode version; re-verify on upgrade.
- Repeat reference measurements 3x and compare averages (model output varies).
- Consider profiles and multi-IDE only after v1 ships.
