import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const credentialName =
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret|private[_-]?key|password|secret|token)/i;
const placeholder = /^(?:|your[-_].*|.*(?:example|placeholder|changeme|replace[-_ ]?me|todo).*)$/i;
const credentialPatterns = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/i,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bBearer\s+(?!\{env:)[A-Za-z0-9._~+/=-]{20,}/i,
];

function credentialLeaks(contents) {
  const leaks = credentialPatterns.filter((pattern) => pattern.test(contents)).map(String);
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s][^=]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
    if (credentialName.test(key.trim()) && !placeholder.test(value)) {
      leaks.push(`credential-like key ${key.trim()}`);
    }
  }
  return leaks;
}

describe("environment configuration", () => {
  it("provides an example with the task-completion preference", async () => {
    const config = await readFile(new URL("../cruzness.yml.example", import.meta.url), "utf8");
    assert.match(config, /^notifications:\r?\n  task_complete: (?:true|false)\r?$/m);
    assert.match(config, /^frontend: (?:true|false)\r?$/m);
    assert.ok(!config.includes("frontend_mcp"), "no legacy frontend_mcp key");
  });

  it("ships third-party plugins as harness dependencies and auto-discovered local adapters", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    assert.equal(packageJson.dependencies["context-mode"], "2.2.2");
    assert.equal(packageJson.dependencies["@dietrichgebert/ponytail"], "5.3.3");
    assert.match(
      await readFile(new URL("../.opencode/plugins/context-mode.js", import.meta.url), "utf8"),
      /from ["']context-mode["']/,
    );
    assert.match(
      await readFile(new URL("../.opencode/plugins/ponytail.js", import.meta.url), "utf8"),
      /from ["']@dietrichgebert\/ponytail["']/,
    );
    const cruznessServer = await readFile(
      new URL("../.opencode/plugins/cruzness.js", import.meta.url),
      "utf8",
    );
    assert.match(cruznessServer, /id:\s*"cruzness"/);
    assert.match(cruznessServer, /registerCruznessMcpServers/);
    const cruznessTui = await readFile(
      new URL("../.opencode/plugins/cruzness-notifications/tui.js", import.meta.url),
      "utf8",
    );
    assert.match(cruznessTui, /id:\s*"cruzness\.notifications\.tui"/);
    assert.match(cruznessTui, /@opencode\/plugin\/tui/);
    assert.match(cruznessTui, /registerTaskCompletionNotification/);
    const notificationsServer = await readFile(
      new URL("../.opencode/plugins/cruzness-notifications/index.js", import.meta.url),
      "utf8",
    );
    assert.match(notificationsServer, /from ["']@opencode\/plugin["']/);
    assert.doesNotMatch(notificationsServer, /@opencode\/plugin\/tui/);
    // A flat file under .opencode/plugins loads as the server part, where the TUI context is absent.
    for (const file of ["context-mode.js", "cruzness.js", "cruzness-frontend.js", "ponytail.js"]) {
      const source = await readFile(new URL(`../.opencode/plugins/${file}`, import.meta.url), "utf8");
      assert.doesNotMatch(source, /@opencode\/plugin\/tui/, `${file} must not load the TUI SDK`);
      assert.doesNotMatch(source, /context\.(?:data|attention)\./, `${file} must not use TUI context`);
    }
    const cruznessFrontend = await readFile(
      new URL("../.opencode/plugins/cruzness-frontend.js", import.meta.url),
      "utf8",
    );
    assert.match(cruznessFrontend, /id:\s*"cruzness\.frontend"/);
    assert.match(cruznessFrontend, /registerFrontendMcpServers/);
    assert.match(cruznessFrontend, /config\.frontend/);
    assert.equal((await import("../.opencode/plugins/context-mode.js")).default.id, "context-mode");
    assert.equal((await import("../.opencode/plugins/ponytail.js")).default.id, "ponytail");
    await assert.rejects(readFile(new URL("../opencode.json", import.meta.url)), {
      code: "ENOENT",
    });
    await assert.rejects(readFile(new URL("../.opencode/opencode.json", import.meta.url)), {
      code: "ENOENT",
    });
  });

  it("ships configuration sources without a byte-order mark", async () => {
    for (const file of ["cruzness.yml.example", ".env.example", "package.json"]) {
      const bytes = await readFile(new URL(`../${file}`, import.meta.url));
      assert.notDeepEqual(
        [...bytes.subarray(0, 3)],
        [0xef, 0xbb, 0xbf],
        `${file} must not start with a BOM`,
      );
    }
  });

  it("keeps MCP server configuration in the CruzNess plugin", async () => {
    const source = await readFile(new URL("../src/cruzness-config.mjs", import.meta.url), "utf8");
    assert.match(source, /context\.mcp\.transform/);
  });

  it("ignores the local config while keeping the example trackable", async () => {
    const directory = path.join(os.tmpdir(), "opencode");
    await mkdir(directory, { recursive: true });
    const repo = await mkdtemp(path.join(directory, "cruzness-ignore-"));
    const git = (args) => spawnSync("git", args, { cwd: repo, stdio: "ignore" });
    try {
      await copyFile(new URL("../.gitignore", import.meta.url), path.join(repo, ".gitignore"));
      await copyFile(
        new URL("../cruzness.yml.example", import.meta.url),
        path.join(repo, "cruzness.yml.example"),
      );
      await writeFile(path.join(repo, "cruzness.yml"), "notifications:\n  task_complete: true\n");
      await writeFile(path.join(repo, ".env.local"), "MY_CUSTOM_TOOL_TOKEN=secret\n");
      assert.equal(git(["init", "--quiet"]).status, 0);
      assert.equal(git(["add", "--all"]).status, 0);
      assert.equal(git(["check-ignore", "--quiet", "cruzness.yml"]).status, 0);
      assert.equal(git(["ls-files", "--error-unmatch", "cruzness.yml"]).status, 1);
      assert.equal(git(["ls-files", "--error-unmatch", "cruzness.yml.example"]).status, 0);
      assert.equal(git(["check-ignore", "--quiet", ".env.local"]).status, 0);
      assert.equal(git(["ls-files", "--error-unmatch", ".env.local"]).status, 1);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("documents every environment variable referenced by the harness configuration", async () => {
    const coreConfig = await readFile(
      new URL("../src/cruzness-config.mjs", import.meta.url),
      "utf8",
    );
    const frontendConfig = await readFile(
      new URL("../src/frontend-config.mjs", import.meta.url),
      "utf8",
    );
    const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
    const references = [
      ...coreConfig.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g),
      ...frontendConfig.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g),
    ].map((match) => match[1]);
    const documented = new Set(
      example
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=/)?.[1])
        .filter(Boolean),
    );

    for (const name of new Set(references)) {
      assert.ok(
        documented.has(name),
        `${name} is referenced by harness configuration but missing from .env.example`,
      );
    }
  });

  it("rejects recognizable hard-coded credentials in the harness configuration", async () => {
    const coreConfig = await readFile(
      new URL("../src/cruzness-config.mjs", import.meta.url),
      "utf8",
    );
    const frontendConfig = await readFile(
      new URL("../src/frontend-config.mjs", import.meta.url),
      "utf8",
    );
    assert.deepEqual(
      credentialLeaks(coreConfig),
      [],
      "Harness plugin configuration contains a hard-coded credential",
    );
    assert.deepEqual(
      credentialLeaks(frontendConfig),
      [],
      "Frontend package configuration contains a hard-coded credential",
    );
  });

  it("detects credential-like keys generically without reading .env values", () => {
    assert.equal(
      credentialLeaks(
        "GITHUB_PERSONAL_ACCESS_TOKEN=live-value-123\nSERVICE_API_KEY=private-value-456",
      ).length,
      2,
    );
  });
});
