import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  readCruznessConfig,
  registerCruznessMcpServers,
  registerTaskCompletionNotification,
} from "../src/cruzness-config.mjs";

async function scratchDirectory() {
  const parent = path.join(tmpdir(), "opencode");
  await mkdir(parent, { recursive: true });
  return mkdtemp(path.join(parent, "cruzness-config-"));
}

describe("CruzNess project configuration", () => {
  it("registers its MCP servers through the harness plugin", async () => {
    let transform;
    const context = {
      mcp: {
        transform: async (callback) => {
          transform = callback;
        },
      },
    };

    await registerCruznessMcpServers(context, {
      GITHUB_PERSONAL_ACCESS_TOKEN: "test-token",
    });

    const servers = new Map();
    transform({
      set: (name, config) => servers.set(name, config),
    });
    assert.deepEqual(
      [...servers.keys()],
      ["context-mode", "context7", "github", "codebase-memory", "mermaid"],
    );
    assert.deepEqual(servers.get("context-mode"), {
      command: ["npx", "-y", "context-mode", "server", "--agent", "opencode"],
      type: "local",
    });
    assert.deepEqual(servers.get("github"), {
      type: "remote",
      url: "https://api.githubcopilot.com/mcp/",
      oauth: false,
      headers: { Authorization: "Bearer test-token" },
    });
  });

  it("disables GitHub MCP when its token is unavailable", async () => {
    let transform;
    await registerCruznessMcpServers(
      { mcp: { transform: async (callback) => (transform = callback) } },
      {},
    );

    const servers = new Map();
    transform({ set: (name, config) => servers.set(name, config) });
    assert.equal(servers.get("github").disabled, true);
    assert.equal(servers.get("github").headers, undefined);
  });

  it("defaults task-completion notifications to disabled when the local file is absent", async () => {
    const directory = await scratchDirectory();
    try {
      assert.deepEqual(await readCruznessConfig(directory), {
        notifications: { task_complete: false },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reads task completion preferences from the local YAML file", async () => {
    const directory = await scratchDirectory();
    try {
      const example = await readFile(new URL("../cruzness.yml.example", import.meta.url), "utf8");
      await writeFile(path.join(directory, "cruzness.yml"), example);

      assert.deepEqual(await readCruznessConfig(directory), {
        notifications: { task_complete: true },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a non-boolean task completion preference", async () => {
    const directory = await scratchDirectory();
    try {
      await writeFile(
        path.join(directory, "cruzness.yml"),
        "notifications:\n  task_complete: yes\n",
      );
      await assert.rejects(
        readCruznessConfig(directory),
        /notifications\.task_complete must be a boolean/,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("registers a system notification only when the preference is enabled", async () => {
    const events = new Map();
    const notifications = [];
    const context = {
      data: {
        on: (event, callback) => {
          events.set(event, callback);
          return () => events.delete(event);
        },
      },
      attention: {
        notify: async (notification) => notifications.push(notification),
      },
    };

    registerTaskCompletionNotification(context, true);
    assert.equal(events.size, 1);
    assert.ok(events.has("session.execution.succeeded"));
    await events.get("session.execution.succeeded")();
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].message, "Task completed");

    events.clear();
    registerTaskCompletionNotification(context, false);
    assert.equal(events.size, 0);
  });
});
