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

A minimal copyable baseline built on opencode only: base configuration plus base agents, so a new project starts from a standard harness aimed at spending fewer tokens.

### 1.3 Goals

- **Primary**: Save tokens, verified by comparing tokens before/after on a reference task.
- **Secondary**: Standardize setup across projects reusing the same baseline.

### 1.4 Non-Goals

Out of v1, per scope decision (opencode only):

- Skills, plugins, hooks beyond the base agents.
- Profiles and advanced customization.
- Automatic token measurement tooling.
- Multi-IDE support.

---

## 2. Requirements

### 2.1 Functional Requirements

#### P0 (Must Have)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-001 | Copyable baseline layout with usage instructions | Cloning the repo and following the [README](README.md) yields the documented file layout in a target project |
| FR-002 | Base opencode configuration | The shipped config loads in opencode without manual fixes |
| FR-003 | Base agents shipped with the baseline | Each documented agent is invokable from opencode and its purpose is described in one line |

#### P1 (Should Have)

Out of scope for v1. TBD.

#### P2 (Nice to Have)

Out of scope for v1. TBD.

### 2.2 Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Lower token spend on a reference task vs. no baseline | TBD (before/after comparison, reference task TBD) |
| Portability | Baseline copies into any project without project-specific edits | Manual copy works on a fresh checkout |
| Reliability | Shipped config and agents load cleanly | No load errors in opencode |

---

## 3. Constraints

- Must integrate with opencode only in v1.
- Must run wherever opencode runs.
- Baseline code in TypeScript, aligned with opencode's stack for now.
- Package manager: bun, if feasible (TBD).

---

## 4. Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Token spend on reference task | TBD | Lower than without baseline | Same prompt and model with/without baseline; compare input+output tokens (reference task TBD) |
| Steps per reference task (key) | TBD | Fewer than without baseline | Count of agent/tool steps to finish the reference task, with/without baseline |
| Setup time in a new project | TBD | TBD | Minutes from clone to working baseline in a fresh project |

---

## 5. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Scope creep (adding skills/MCPs before v1 lands) | Medium | Medium | Keep v1 to opencode config + agents; defer the rest explicitly |
| Token saving unproven (no reference measurement yet) | High | Medium | Define one reference task and record before/after before claiming savings |
| opencode drift (upstream changes break the baseline) | Medium | Medium | Pin the supported opencode version in the [README](README.md); re-verify on upgrade |
| Measurement noise (model output varies run to run) | Medium | Low | Repeat the reference task 3 times and compare averages |

---

## 6. Timeline

| Milestone | Description | Target Date |
|-----------|-------------|-------------|
| M1 | v1 scope frozen | TBD |
| M2 | Baseline ships (FR-001..FR-003 verifiable) | TBD |


