import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";

const require = createRequire(import.meta.url);
const executable = process.platform === "win32" ? "opencode.exe" : "opencode";
const version = spawnSync(executable, ["--version"], { encoding: "utf8" });
const available = version.status === 0 && /\bv?2\./.test(version.stdout);

it(
  "loads frontend agents, skills and MCP registrations in isolated OpenCode V2",
  {
    skip: !available && "OpenCode V2 CLI is not installed",
  },
  async (t) => {
    const parent = path.join(tmpdir(), "opencode");
    await mkdir(parent, { recursive: true });
    const root = await mkdtemp(path.join(parent, "cruzness-isolated-"));
    const plugins = path.join(root, ".opencode", "plugins");
    const configHome = path.join(root, "config-home");
    const globalConfig = path.join(configHome, "opencode");

    try {
      await mkdir(plugins, { recursive: true });
      await mkdir(globalConfig, { recursive: true });
      await mkdir(path.join(root, ".opencode", "fixtures"));
      execFileSync("git", ["init", "--quiet"], { cwd: root });
      for (const dir of ["frontend", "src"]) {
        await cp(new URL(`../${dir}/`, import.meta.url), path.join(root, dir), { recursive: true });
      }
      await cp(
        path.dirname(require.resolve("yaml/package.json")),
        path.join(root, "node_modules", "yaml"),
        { recursive: true },
      );
      await cp(
        new URL("../.opencode/plugins/cruzness-frontend.js", import.meta.url),
        path.join(root, ".opencode", "fixtures", "frontend-under-test.mjs"),
      );
      await cp(
        new URL("../.opencode/plugins/cruzness-notifications/", import.meta.url),
        path.join(plugins, "cruzness-notifications"),
        { recursive: true },
      );
      // Keep the shipped plugin and its callbacks intact, but never start tools or contact an MCP.
      await writeFile(
        path.join(plugins, "cruzness-frontend.js"),
        `import { Plugin } from "@opencode/plugin";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import frontend from "../fixtures/frontend-under-test.mjs";
export default Plugin.define({
  id: frontend.id,
  async setup(context) {
    return frontend.setup({
      location: context.location,
      mcp: {
        transform: async (apply) => {
          const servers = new Map();
          apply(servers);
          await writeFile(path.join(context.location.directory, "fixture-mcp.json"), JSON.stringify(Object.fromEntries(servers)));
          return context.mcp.transform((editor) => {
            for (const [name, config] of servers) editor.set(name, { ...config, disabled: true });
          });
        },
      },
    });
  },
});`,
      );
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([key]) =>
          /^(path|systemroot|windir|comspec|pathext|temp|tmp)$/i.test(key),
        ),
      );
      Object.assign(env, {
        HOME: root,
        USERPROFILE: root,
        APPDATA: path.join(root, "appdata"),
        LOCALAPPDATA: path.join(root, "localappdata"),
        XDG_CONFIG_HOME: configHome,
        XDG_DATA_HOME: path.join(root, "data"),
        XDG_CACHE_HOME: path.join(root, "cache"),
        XDG_STATE_HOME: path.join(root, "state"),
        OPENCODE_CONFIG_DIR: globalConfig,
        OPENCODE_DISABLE_AUTOUPDATE: "1",
        OPENCODE_DISABLE_DEFAULT_PLUGINS: "1",
        OPENCODE_DISABLE_MODELS_FETCH: "1",
      });
      const run = (...args) =>
        execFileSync(executable, [...args, "--standalone"], {
          cwd: root,
          env,
          encoding: "utf8",
          timeout: 20_000,
        });
      const remote = { type: "remote", url: "https://example.test/mcp" };
      const frontendTools = {
        seo: { ...remote, name: "my-seo" },
        analytics: [
          { ...remote, name: "my-metrics" },
          { ...remote, name: "my-traffic" },
        ],
      };
      for (const frontend of [false, true]) {
        await t.test(frontend ? "frontend enabled" : "frontend disabled", async () => {
          const mcpProbe = path.join(root, "fixture-mcp.json");
          await rm(mcpProbe, { force: true });
          await writeFile(
            path.join(root, "cruzness.yml"),
            JSON.stringify({ frontend, frontendTools }),
          );
          execFileSync(process.execPath, [path.join(root, "frontend", "scripts", "sync-frontend.mjs")], {
            cwd: root,
            env,
            encoding: "utf8",
          });
          const agents = JSON.parse(run("debug", "agents"));
          const mcps = JSON.parse(
            await readFile(mcpProbe, "utf8").catch((error) => {
              if (error.code === "ENOENT") return "{}";
              throw error;
            }),
          );
          const skillFile = await readFile(
            path.join(root, ".opencode", "skills", "frontend-design", "SKILL.md"),
            "utf8",
          ).then(
            () => true,
            () => false,
          );
          const denies = (agent, name) =>
            agent?.permissions.some(
              ({ action, effect }) => action === `${name}_*` && effect === "deny",
            ) ?? false;
          const agentIds = ["frontend/analytics", "frontend/seo", "frontend/ui"];
          const present = agents
            .map(({ id }) => id)
            .filter((id) => agentIds.includes(id))
            .sort();
          for (const name of [
            "browse",
            "imagetooling",
            "storybook",
            "open-pencil",
            "my-seo",
            "my-metrics",
            "my-traffic",
          ]) {
            assert.equal(Object.hasOwn(mcps, name), frontend, name);
          }
          assert.deepEqual(
            {
              agents: present,
              skill: skillFile,
              deniesSeo: denies(agents.find(({ id }) => id === "frontend/ui"), "my-seo"),
              deniesStorybook: denies(agents.find(({ id }) => id === "frontend/seo"), "storybook"),
            },
            {
              agents: frontend ? agentIds : [],
              skill: frontend,
              deniesSeo: frontend,
              deniesStorybook: frontend,
            },
          );
        });
      }
      const log = await readFile(
        path.join(root, "data", "opencode", "log", "opencode.log"),
        "utf8",
      ).catch(() => "");
      assert.doesNotMatch(log, /failed to load plugin/, "every auto-discovered plugin must load");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
