import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { readCruznessConfig } from "../src/cruzness-config.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const opencodeAvailable = spawnSync("opencode", ["--version"], { encoding: "utf8" }).status === 0;

describe("isolated OpenCode configuration", () => {
  it(
    "loads the isolated CruzNess plugin and exposes its TUI entrypoint",
    { skip: !opencodeAvailable && "OpenCode CLI is not installed" },
    async () => {
      const tempDirectory = path.join(os.tmpdir(), "opencode");
      await mkdir(tempDirectory, { recursive: true });
      const tempRoot = await mkdtemp(path.join(tempDirectory, "cruzness-opencode-"));
      const configDirectory = path.join(tempRoot, "global-config");
      const projectDirectory = path.join(tempRoot, "project");
      try {
        const pluginsDirectory = path.join(projectDirectory, ".opencode", "plugins");
        await mkdir(configDirectory, { recursive: true });
        await mkdir(pluginsDirectory, { recursive: true });
        await copyFile(
          path.join(root, ".opencode", "plugins", "cruzness.js"),
          path.join(pluginsDirectory, "cruzness.js"),
        );
        await copyFile(
          path.join(root, ".opencode", "plugins", "cruzness-notifications.js"),
          path.join(pluginsDirectory, "cruzness-notifications.js"),
        );
        await mkdir(path.join(projectDirectory, "src"), { recursive: true });
        await copyFile(
          path.join(root, "src", "cruzness-config.mjs"),
          path.join(projectDirectory, "src", "cruzness-config.mjs"),
        );
        await copyFile(
          path.join(root, "cruzness.yml.example"),
          path.join(projectDirectory, "cruzness.yml"),
        );
        assert.deepEqual(await readCruznessConfig(projectDirectory), {
          notifications: { task_complete: true },
        });

        const env = { ...process.env, OPENCODE_CONFIG_DIR: configDirectory };
        delete env.OPENCODE_CONFIG;
        const sources = JSON.parse(
          execFileSync("opencode", ["debug", "config", "--standalone"], {
            cwd: projectDirectory,
            env,
            encoding: "utf8",
          }),
        );

        assert.deepEqual(
          sources.map(({ type, path: sourcePath }) => [type, path.resolve(sourcePath)]),
          [
            ["directory", path.resolve(configDirectory)],
            ["directory", path.join(projectDirectory, ".opencode")],
          ],
        );

        const serverSource = await readFile(
          path.join(pluginsDirectory, "cruzness.js"),
          "utf8",
        );
        assert.match(serverSource, /registerCruznessMcpServers/);
        const tuiSource = await readFile(
          path.join(pluginsDirectory, "cruzness-notifications.js"),
          "utf8",
        );
        assert.match(tuiSource, /readCruznessConfig/);
        assert.match(tuiSource, /registerTaskCompletionNotification/);

        const plugins = execFileSync("opencode", ["plugin", "list", "--standalone"], {
          cwd: projectDirectory,
          env,
          encoding: "utf8",
        });
        assert.ok(
          plugins.toLowerCase().includes("cruzness") ||
            plugins.toLowerCase().includes("no plugins found"),
          `Unexpected isolated plugin list output: ${plugins}`,
        );
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    },
  );
});
