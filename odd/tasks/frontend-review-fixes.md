Objective: Correct the staged frontend review findings without reorganizing test files.
Branch: `feat/frontend-plugin`; delivery: ask-on-risk; test runner: `node --test tests/`.

## Specs

- S1. “Sin ser esto corrige todos los erroes”: launch the bundled Storybook MCP with the other default frontend MCPs. The user selected “Arrancar el MCP integrado”. Enforce one SEO definition and allow multiple distinct analytics MCPs without overwriting built-ins or core servers.
- S2. “Sin ser esto corrige todos los erroes”: wait for OpenCode registrations, isolate configured MCPs by agent role, and make the integration check prove frontend behavior rather than accept `no plugins found`.
- S3. “Sin ser esto corrige todos los erroes”: make skill sync target the OpenCode project and work on Windows; align documentation with actual credential behavior.
- S4. “Revisar si hay test que se duplican, no se dividen en los suficientes ficheros y demás”: report duplication and file boundaries separately. Keep the existing test-file layout.

## Tasks

- [x] T1 — S1/S2; inline: interdependent plugin, configuration and integration tests; unit + isolated runtime GREEN, permissions now written to agent frontmatter; Risk: item 2 (agent permissions).
- [x] T2 — S3; inline: local CLI invocation and docs; sync copies installs into the scanned directory; BOM removed; focused suite GREEN; Risk: item 5 (installer).
- [x] T3 — S4; inline read-only: reported duplicate default-MCP cases and mixed test responsibilities.

## Log

L1:
> Revisar si hay test que se duplican, no se dividen en los suficientes ficheros y demás
>
> Sin ser esto corrige todos los erroes

L2: User selected “Arrancar el MCP integrado” for Storybook.

L3: Targeted unit RED: seven failures across launch defaults, validation, role permissions and sync arguments. Those focused tests now pass.

L4: Skill sync dry-run passed; Windows Node-launched `npx-cli.js --version` succeeded; Git ignores the intended `.agents/skills` outputs. Actual installation was not run.

L5: The OpenCode V2.3.2 fixture observes the requested MCP registration payloads without starting tool processes. The CLI still shows all three project agents when disabled, and the enabled UI agent lacks its role deny rule because the transform editor only sees built-ins. The skill list requested during plugin setup also returns no frontend skills; enabled skill visibility remains unverified. Full suite: 45 passed, both mode subtests failed (the enclosing suite counts as the third failure). No existing staged files were restaged.

L6: "pues arregla el fallo por favor". Probed OpenCode 2.4.0 with an instrumented plugin: AgentEditor has no `add`, and file-based agents/skills register after every plugin setup, so `ctx.agent.transform` / `ctx.skill.transform` can never see, add, or hide them. User chose materialization. Agents moved to `frontend/agents/`, vendored skills to `frontend/skills/`; `frontend/scripts/sync-frontend.mjs` copies them into `.opencode/` with per-role deny rules in the agent frontmatter, or removes them when `frontend: false`. The plugin now only registers MCPs. `.opencode/agents/frontend/` and `.opencode/skills/` are Git-ignored. Isolated test GREEN in both modes (agents, frontmatter denies, MCPs, skill files); full suite 48 passed; oxlint clean. Verified in the real repo: `frontend/seo` now denies `browse_*`, `imagetooling_*`, `storybook_*`. Not run: OS notification with a blurred TUI.

L7: Independent verification (S1 met, S3 not met, S2 met) found two real defects. Fixed: `sync-skills.mjs` installed only under `.agents/skills/`, which OpenCode never scans; it now copies each install to `.opencode/skills/` (exported `copyInstalledSkills`), and the ignore rules changed to the whole `.opencode/skills/`. Also stripped the UTF-8 BOM from `.env.example` that would make `GITHUB_PERSONAL_ACCESS_TOKEN` the first key name. Tests added for exact per-role deny sets, sentinel preservation, dry-run, `.agents` -> `.opencode` copy, and BOM absence. Full suite: 51 passed; oxlint clean. Open advisories: `imagetooling`'s docker bind does not expand `~`/`$HOME`; runtime enforcement of tool-level `browse_*` denies is unverified because it needs a real tool call.
