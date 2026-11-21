# PRD: Cruzness

**Version**: 0.1
**Date**: 2026-11-17
**Author**: TBD
**Status**: Draft

---

## 1. Overview

### 1.1 Problem Statement

Developers using AI coding assistants overspend tokens because every project re-builds its harness from scratch. Cruzness exists for anyone cloning it open source who wants a reusable starting point instead of paying that setup cost on every task.

### 1.2 Solution Summary

A minimal copyable baseline built on OpenCode: its base configuration and agents, plus a CruzNess-owned YAML file for project preferences.

### 1.3 Goals

- **Primary**: Save tokens, verified by comparing tokens before/after on a reference task.
- **Secondary**: Standardize setup across projects reusing the same baseline.
- Keep per-project CruzNess preferences in `cruzness.yml`.

### 1.4 Non-Goals

Out of v1, per scope decision (opencode only):

- Skills, plugins, hooks beyond the base agents.
- Profiles and advanced customization.
- Multi-IDE support.

---

## 2. Requirements

### 2.1 Functional Requirements

#### P0 (Must Have)

| ID     | Requirement                                      | Acceptance Criteria                                                                                                         |
| ------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| FR-001 | Copyable baseline layout with usage instructions | Cloning the repo and following the [README](README.md) yields the documented file layout in a target project                |
| FR-002 | Base opencode configuration                      | The shipped config loads in opencode without manual fixes                                                                   |
| FR-003 | Base agents shipped with the baseline            | Each documented agent is invokable from opencode and its purpose is described in one line                                   |
| FR-004 | Project preferences in `cruzness.yml`            | The file documents the task-completion notification preference as a boolean; it is not presented as an OpenCode config file |

#### P1 (Should Have)

Out of scope for v1. TBD.

#### P2 (Nice to Have)

Out of scope for v1. TBD.

### 2.2 Non-Functional Requirements

| Category    | Requirement                                                     | Target                                            |
| ----------- | --------------------------------------------------------------- | ------------------------------------------------- |
| Performance | Lower token spend on a reference task vs. no baseline           | TBD (before/after comparison, reference task TBD) |
| Portability | Baseline copies into any project without project-specific edits | Manual copy works on a fresh checkout             |
| Reliability | Shipped OpenCode config and agents load cleanly                 | No load errors in opencode                        |

---

## 3. Constraints

- Must integrate with opencode only in v1.
- Must run wherever opencode runs.
- Baseline code in TypeScript, aligned with opencode's stack for now.
- Package manager: bun, if feasible (TBD).

---

## 4. Success Metrics

Compare vanilla, GentleAI, and CruzNess on the same benchmark tasks, repository snapshot, model, and run conditions. Metrics are task success, steps, input-plus-output tokens, and wall-clock task execution time; setup time is optional and measured separately. Run each task three times per setup and report results per task. See [metrics/tasks.md](metrics/tasks.md) for task examples and scoring.

---

## 5. Risks

| Risk                                                 | Likelihood | Impact | Mitigation                                                                          |
| ---------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------- |
| Scope creep (adding skills/MCPs before v1 lands)     | Medium     | Medium | Keep runtime behavior in OpenCode; defer unimplemented integrations explicitly      |
| Token saving unproven (no reference measurement yet) | High       | Medium | Define one reference task and record before/after before claiming savings           |
| opencode drift (upstream changes break the baseline) | Medium     | Medium | Pin the supported opencode version in the [README](README.md); re-verify on upgrade |
| Measurement noise (model output varies run to run)   | Medium     | Low    | Repeat the reference task 3 times and compare averages                              |

---

## 6. Timeline

| Milestone | Description                                | Target Date |
| --------- | ------------------------------------------ | ----------- |
| M1        | v1 scope frozen                            | TBD         |
| M2        | Baseline ships (FR-001..FR-003 verifiable) | TBD         |
