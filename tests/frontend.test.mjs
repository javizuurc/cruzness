import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { registerFrontendMcpServers } from "../src/frontend-config.mjs";

describe("CruzNess frontend package", () => {
  it("registers OpenPencil as a built-in UI MCP", async () => {
    const registered = new Map();
    await registerFrontendMcpServers(
      {
        mcp: {
          transform: (callback) =>
            callback({
              get: (name) => registered.get(name),
              set: (name, config) => registered.set(name, config),
            }),
        },
      },
      { enabled: true },
    );

    assert.deepEqual(registered.get("open-pencil"), {
      type: "local",
      command: ["npx", "-y", "@open-pencil/mcp"],
      disabled: false,
    });
  });

  it("ships UI, SEO and analytics agents with agnostic user-provided tools", async () => {
    const ui = await readFile(
      new URL("../frontend/agents/ui.md", import.meta.url),
      "utf8",
    );
    const seo = await readFile(
      new URL("../frontend/agents/seo.md", import.meta.url),
      "utf8",
    );
    const analytics = await readFile(
      new URL("../frontend/agents/analytics.md", import.meta.url),
      "utf8",
    );

    for (const agent of [ui, seo, analytics]) {
      assert.match(agent, /^description: .+$/m);
      assert.ok(
        agent.includes("user-provided") || agent.includes("user-configured"),
        "agent must be agnostic (user-provided tools)",
      );
    }

    for (const agent of [ui, seo, analytics]) {
      assert.doesNotMatch(agent, /^tools:/m);
    }
  });

  it("gives each agent its own skills, sharing only web guidance", async () => {
    const ui = await readFile(
      new URL("../frontend/agents/ui.md", import.meta.url),
      "utf8",
    );
    const seo = await readFile(
      new URL("../frontend/agents/seo.md", import.meta.url),
      "utf8",
    );
    const analytics = await readFile(
      new URL("../frontend/agents/analytics.md", import.meta.url),
      "utf8",
    );

    assert.ok(
      ui.includes("verification") || ui.includes("browser"),
      "ui agent must verify in the browser",
    );
    assert.ok(!ui.includes("playwright"), "playwright is replaced by Browse");
    assert.ok(!seo.includes("playwright"), "playwright is replaced by Browse");
    assert.ok(
      analytics.includes("behavior") || analytics.includes("traffic"),
      "analytics agent must own behavior/traffic data",
    );
    assert.ok(!seo.includes("clarity_*: true"), "clarity belongs to analytics");
    assert.ok(!seo.includes("`clarity` —"), "seo agent must not list the clarity MCP");
    assert.ok(
      !analytics.includes("`clarity` —"),
      "analytics agent must not hardcode the clarity MCP",
    );
    assert.ok(
      !analytics.includes("`google-analytics` —"),
      "analytics agent must not hardcode the google-analytics MCP",
    );
    assert.ok(seo.includes("analytics agent"), "seo agent must hand traffic work to analytics");

    for (const skill of [
      "frontend-design",
      "design-taste-frontend",
      "impeccable",
      "gsap-core",
      "transitions-dev",
    ]) {
      assert.ok(ui.includes(skill), `ui agent must reference ${skill}`);
      assert.ok(!seo.includes(skill), `seo agent must not claim ${skill}`);
    }
    assert.ok(ui.includes("modern-web-guidance"));
    assert.ok(seo.includes("modern-web-guidance"));
    assert.ok(analytics.includes("modern-web-guidance"));
  });

  it("vendors the small skill wrappers and indexes the rest", async () => {
    for (const skill of ["frontend-design", "design-taste-frontend"]) {
      const wrapper = await readFile(
        new URL(`../frontend/skills/${skill}/SKILL.md`, import.meta.url),
        "utf8",
      );
      assert.match(wrapper, /^name: /m);
      assert.match(wrapper, /^description: /m);
    }

    const registry = await readFile(
      new URL("../frontend/skills/REGISTRY.md", import.meta.url),
      "utf8",
    );
    for (const skill of [
      "gsap-core",
      "transitions-dev",
      "transitions-polish",
      "make-interfaces-feel-better",
      "modern-web-guidance",
      "impeccable",
    ]) {
      assert.ok(registry.includes(skill), `registry must list ${skill}`);
    }

    const lock = JSON.parse(
      await readFile(new URL("../frontend/skills-lock.json", import.meta.url), "utf8"),
    );
    for (const skill of ["gsap-core", "modern-web-guidance", "transitions-dev"]) {
      assert.ok(lock.skills[skill], `skills-lock must pin ${skill}`);
    }

    const { frontendAgentIds, frontendSkillIds } = await import("../src/frontend-config.mjs");
    assert.deepEqual(frontendAgentIds, ["frontend/ui", "frontend/seo", "frontend/analytics"]);
    for (const skill of Object.keys(lock.skills)) {
      assert.ok(frontendSkillIds.includes(skill), `gating must cover locked skill ${skill}`);
    }
    for (const skill of ["frontend-design", "design-taste-frontend", "impeccable"]) {
      assert.ok(frontendSkillIds.includes(skill), `gating must cover ${skill}`);
    }
  });

  it("shows real frontendTools usage with no commented examples", async () => {
    const example = await readFile(new URL("../cruzness.yml.example", import.meta.url), "utf8");
    assert.match(example, /^frontend: false\r?$/m);
    assert.match(example, /^notifications:\r?\n  task_complete: true\r?$/m);
    assert.ok(!example.includes("enabled"), "no nested enabled key");
    assert.ok(!example.includes("frontend_mcp"), "no legacy frontend_mcp key");
    assert.ok(!example.includes("#"), "no commented examples");
    assert.match(example, /^frontendTools:\r?$/m);
    assert.ok(example.includes("my-seo"), "example uses a custom seo definition");
    assert.ok(example.includes("my-analytics"), "example uses custom analytics definitions");
    assert.ok(example.includes("my-traffic"), "analytics shows more than one MCP");
    assert.ok(example.includes("https://example.test/mcp"), "example uses custom urls");
    for (const name of [
      "openseo",
      "clarity",
      "google-analytics",
      "browse",
      "astro-docs",
      "storybook",
    ]) {
      assert.ok(!example.includes(name), "example must not hardcode " + name);
    }
  });

  it("materializes the package from cruzness.yml and removes it when disabled", async () => {
    const { syncFrontend } = await import("../frontend/scripts/sync-frontend.mjs");
    const parent = path.join(os.tmpdir(), "opencode");
    await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(path.join(parent, "cruzness-frontend-"));
    const logs = [];
    const log = (line) => logs.push(line);
    const remote = { type: "remote", url: "https://example.test/mcp" };
    const tools = { seo: { ...remote, name: "my-seo" } };
    try {
      assert.deepEqual(await syncFrontend({ directory, enabled: true, tools, log }), {
        enabled: true,
        files: 5,
      });
      const ui = await readFile(path.join(directory, ".opencode/agents/frontend/ui.md"), "utf8");
      const seo = await readFile(path.join(directory, ".opencode/agents/frontend/seo.md"), "utf8");
      assert.match(ui, /^description: /m);
      assert.match(ui, /my-seo_\*/);
      assert.match(seo, /storybook_\*/);
      assert.doesNotMatch(seo, /my-seo_\*/);
      const analytics = await readFile(
        path.join(directory, ".opencode/agents/frontend/analytics.md"),
        "utf8",
      );
      const rules = (markdown) =>
        new Set(
          parse(markdown.split(/^---$/m)[1]).permissions.map(
            ({ action, resource, effect }) => `${action}|${resource}|${effect}`,
          ),
        );
      const uiRules = rules(ui);
      const seoRules = rules(seo);
      const analyticsRules = rules(analytics);
      assert.equal(uiRules.size, 3);
      assert.equal(seoRules.size, 12);
      assert.equal(analyticsRules.size, 15);
      assert.ok(uiRules.has("my-seo_*|*|deny"));
      assert.ok(seoRules.has("opencode_read_mcp_resource|storybook:*|deny"));
      assert.ok(seoRules.has("open-pencil_*|*|deny"));
      assert.ok(!seoRules.has("my-seo_*|*|deny"));
      assert.ok(analyticsRules.has("my-seo_*|*|deny"));
      await mkdir(path.join(directory, ".opencode/skills/unrelated"), { recursive: true });
      await writeFile(
        path.join(directory, ".opencode/skills/unrelated/SKILL.md"),
        "keep me",
      );
      for (const id of ["frontend-design", "design-taste-frontend"]) {
        const skill = await readFile(path.join(directory, `.opencode/skills/${id}/SKILL.md`), "utf8");
        assert.match(skill, /^name: /m);
      }

      logs.length = 0;
      await syncFrontend({ directory, enabled: true, tools, log });
      assert.ok(
        logs.every((line) => line.startsWith("unchanged: ")),
        `second run must not rewrite files: ${logs.join(", ")}`,
      );

      const dryRun = [];
      await syncFrontend({
        directory,
        enabled: false,
        dryRun: true,
        log: (line) => dryRun.push(line),
      });
      assert.ok(dryRun.length > 0 && dryRun.every((line) => line.startsWith("[dry-run] ")));
      assert.match(
        await readFile(path.join(directory, ".opencode/agents/frontend/ui.md"), "utf8"),
        /^---/,
      );

      assert.deepEqual(await syncFrontend({ directory, enabled: false, log }), {
        enabled: false,
        files: 0,
      });
      for (const target of [
        ".opencode/agents/frontend/ui.md",
        ".opencode/skills/frontend-design/SKILL.md",
      ]) {
        await assert.rejects(readFile(path.join(directory, target)), { code: "ENOENT" });
      }
      assert.equal(
        await readFile(path.join(directory, ".opencode/skills/unrelated/SKILL.md"), "utf8"),
        "keep me",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("updates external skills from their origin repos via the lock", async () => {
    const { buildInstallCommands, readSkillsLock } =
      await import("../frontend/scripts/sync-skills.mjs");
    const skills = await readSkillsLock();
    const commands = buildInstallCommands(skills);

    assert.ok(commands.length > 0);
    for (const { name, command } of commands) {
      assert.deepEqual(command, [
        "npx",
        "-y",
        "skills",
        "add",
        `https://github.com/${skills[name].source}`,
        "--skill",
        name,
        "--agent",
        "opencode",
        "--copy",
        "--yes",
      ]);
      assert.ok(skills[name].skillPath, `${name} pins its skill path`);
    }
    const names = commands.map(({ name }) => name);
    const dryRun = execFileSync(
      process.execPath,
      [fileURLToPath(new URL("../frontend/scripts/sync-skills.mjs", import.meta.url)), "--dry-run"],
      { encoding: "utf8" },
    );
    assert.match(dryRun, new RegExp(`done: ${names.length} skills`));
    assert.match(dryRun, /--agent opencode --copy --yes/);
    for (const expected of [
      "gsap-core",
      "modern-web-guidance",
      "transitions-dev",
      "make-interfaces-feel-better",
    ]) {
      assert.ok(names.includes(expected), `lock must pin ${expected}`);
    }
  });

  it("copies locked skill installs into the directory OpenCode scans", async () => {
    const { copyInstalledSkills } = await import("../frontend/scripts/sync-skills.mjs");
    const parent = path.join(os.tmpdir(), "opencode");
    await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(path.join(parent, "cruzness-skills-"));
    try {
      await mkdir(path.join(directory, ".agents/skills/gsap-core"), { recursive: true });
      await writeFile(path.join(directory, ".agents/skills/gsap-core/SKILL.md"), "pinned\n");
      await mkdir(path.join(directory, ".opencode/skills/gsap-core"), { recursive: true });
      await writeFile(path.join(directory, ".opencode/skills/gsap-core/stale.md"), "stale\n");

      await copyInstalledSkills(["gsap-core"], directory);

      assert.equal(
        await readFile(path.join(directory, ".opencode/skills/gsap-core/SKILL.md"), "utf8"),
        "pinned\n",
      );
      await assert.rejects(
        readFile(path.join(directory, ".opencode/skills/gsap-core/stale.md")),
        { code: "ENOENT" },
      );
      await assert.rejects(copyInstalledSkills(["missing"], directory), { code: "ENOENT" });
      assert.equal(
        await readFile(path.join(directory, ".opencode/skills/gsap-core/SKILL.md"), "utf8"),
        "pinned\n",
        "a failed copy must not destroy the previous install",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps per-user values out of the baseline", async () => {
    const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
    assert.match(example, /^GITHUB_PERSONAL_ACCESS_TOKEN=your-/m);
    for (const name of [
      "OPENSEO_API_KEY",
      "CLARITY_API_TOKEN",
      "GOOGLE_APPLICATION_CREDENTIALS",
      "GOOGLE_CLOUD_PROJECT",
    ]) {
      assert.ok(!example.includes(name), "baseline must not reference " + name);
    }
    const frontendConfig = await readFile(
      new URL("../src/frontend-config.mjs", import.meta.url),
      "utf8",
    );
    for (const name of ["clarity", "google-analytics", "openseo", "astro-docs"]) {
      assert.ok(
        !frontendConfig.includes('"' + name + '"') && !frontendConfig.includes("'" + name + "'"),
        "frontend config must not hardcode " + name,
      );
    }
    const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
    assert.match(gitignore, /^\/\.env\.local$/m);
  });
});
