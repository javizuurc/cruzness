import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  frontendAgentPermissions,
  readCruznessConfig,
  registerCruznessMcpServers,
  registerFrontendMcpServers,
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
        frontend: false,
        frontendTools: {},
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
        frontend: false,
        frontendTools: {
          seo: { name: "my-seo", type: "remote", url: "https://example.test/mcp" },
          analytics: [
            { name: "my-analytics", type: "remote", url: "https://example.test/mcp" },
            { name: "my-traffic", type: "remote", url: "https://example.test/mcp" },
          ],
        },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reads the frontend toggle independently of the core", async () => {
    const directory = await scratchDirectory();
    try {
      await writeFile(
        path.join(directory, "cruzness.yml"),
        "notifications:\n  task_complete: false\nfrontend: true\n",
      );

      assert.deepEqual(await readCruznessConfig(directory), {
        notifications: { task_complete: false },
        frontend: true,
        frontendTools: {},
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

  it("rejects a non-boolean frontend toggle", async () => {
    const directory = await scratchDirectory();
    try {
      await writeFile(
        path.join(directory, "cruzness.yml"),
        "notifications:\n  task_complete: true\nfrontend: yes\n",
      );
      await assert.rejects(readCruznessConfig(directory), /frontend must be a boolean/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("registers no frontend servers while the package is disabled", async () => {
    let called = false;
    const context = {
      mcp: {
        transform: async () => {
          called = true;
        },
      },
    };

    await registerFrontendMcpServers(context, { enabled: false });

    assert.equal(called, false);
  });

  it("launches the built-in frontend MCP servers by default", async () => {
    let transform;
    const context = {
      mcp: {
        transform: async (callback) => {
          transform = callback;
        },
      },
    };

    await registerFrontendMcpServers(context, { enabled: true, directory: "C:/proj" }, {});

    const servers = new Map();
    transform({
      set: (name, config) => servers.set(name, config),
    });
    assert.deepEqual([...servers.keys()], ["browse", "imagetooling", "storybook", "open-pencil"]);
    assert.equal(servers.get("storybook").type, "local");
    assert.equal(servers.get("storybook").disabled, false);
    assert.match(servers.get("storybook").command.join(" "), /storybook-mcp/);
    assert.deepEqual(servers.get("browse"), {
      type: "local",
      command: ["npx", "-y", "@opencode/browse", "mcp"],
      disabled: false,
    });
    assert.equal(servers.get("imagetooling").disabled, false);
    assert.ok(servers.get("imagetooling").command.includes("type=bind,src=C:/proj,dst=/workspace"));
    assert.deepEqual(servers.get("open-pencil"), {
      type: "local",
      command: ["npx", "-y", "@open-pencil/mcp"],
      disabled: false,
    });
  });

  it("selects only the servers named by frontendTools roles", async () => {
    let transform;
    await registerFrontendMcpServers(
      { mcp: { transform: async (callback) => (transform = callback) } },
      {
        enabled: true,
        tools: {
          seo: { name: "my-seo", type: "remote", url: "https://example.test/mcp" },
          analytics: { name: "my-analytics", type: "remote", url: "https://example.test/mcp" },
        },
      },
      {},
    );

    const servers = new Map();
    transform({ set: (name, config) => servers.set(name, config) });
    assert.deepEqual(
      [...servers.keys()],
      ["my-seo", "my-analytics", "browse", "imagetooling", "storybook", "open-pencil"],
    );
  });

  it("registers a custom definition under its own name", async () => {
    let transform;
    await registerFrontendMcpServers(
      { mcp: { transform: async (callback) => (transform = callback) } },
      {
        enabled: true,
        tools: {
          analytics: {
            name: "my-analytics",
            type: "remote",
            url: "https://example.test/mcp",
          },
        },
      },
      {},
    );

    const servers = new Map();
    transform({ set: (name, config) => servers.set(name, config) });
    assert.equal(servers.get("my-analytics").url, "https://example.test/mcp");
    assert.deepEqual(
      [...servers.keys()],
      ["my-analytics", "browse", "imagetooling", "storybook", "open-pencil"],
    );
  });

  it("reads frontendTools roles from cruzness.yml", async () => {
    const directory = await scratchDirectory();
    try {
      await writeFile(
        path.join(directory, "cruzness.yml"),
        "notifications:\n  task_complete: true\nfrontend: true\nfrontendTools:\n  seo:\n    name: my-seo\n    type: remote\n    url: https://example.test/mcp\n",
      );

      assert.deepEqual(await readCruznessConfig(directory), {
        notifications: { task_complete: true },
        frontend: true,
        frontendTools: { seo: { name: "my-seo", type: "remote", url: "https://example.test/mcp" } },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects frontend_mcp and invalid frontendTools", async () => {
    const directory = await scratchDirectory();
    try {
      await writeFile(
        path.join(directory, "cruzness.yml"),
        "notifications:\n  task_complete: true\nfrontend: true\nfrontend_mcp:\n  openseo: false\n",
      );
      await assert.rejects(readCruznessConfig(directory), /replaced by frontendTools/);

      await writeFile(
        path.join(directory, "cruzness.yml"),
        "notifications:\n  task_complete: true\nfrontend: true\nfrontendTools:\n  unknown-role: openseo\n",
      );
      await assert.rejects(
        readCruznessConfig(directory),
        /unknown frontendTools role "unknown-role"/,
      );

      await writeFile(
        path.join(directory, "cruzness.yml"),
        "notifications:\n  task_complete: true\nfrontend: true\nfrontendTools:\n  seo: 42\n",
      );
      await assert.rejects(readCruznessConfig(directory), /frontendTools\.seo must be/);

      await writeFile(
        path.join(directory, "cruzness.yml"),
        "notifications:\n  task_complete: true\nfrontend: true\nfrontendTools:\n  - seo\n",
      );
      await assert.rejects(readCruznessConfig(directory), /frontendTools must be a YAML mapping/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }

    assert.throws(
      () =>
        registerFrontendMcpServers(
          { mcp: { transform: async () => {} } },
          { enabled: true, servers: { openseo: false } },
        ),
      /replaced by frontendTools/,
    );
  });

  it("rejects role cardinality and MCP name collisions before registering servers", async () => {
    const directory = await scratchDirectory();
    const definition = { type: "remote", url: "https://example.test/mcp" };
    try {
      for (const [tools, message] of [
        [{ seo: [definition, definition] }, /single.*seo|seo.*single/i],
        [{ analytics: [definition, definition] }, /duplicate.*analytics/i],
        [{ analytics: [[definition]] }, /server definition/i],
        [{ seo: { ...definition, name: "storybook" } }, /reserved.*storybook/i],
        [{ seo: { ...definition, name: "context7" } }, /reserved.*context7/i],
      ]) {
        await writeFile(
          path.join(directory, "cruzness.yml"),
          JSON.stringify({ frontend: true, frontendTools: tools }),
        );
        await assert.rejects(readCruznessConfig(directory), message);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("registers the defaults when no tools are configured", async () => {
    let transform;
    await registerFrontendMcpServers(
      { mcp: { transform: async (callback) => (transform = callback) } },
      { enabled: true },
      {},
    );

    const servers = new Map();
    transform({ set: (name, config) => servers.set(name, config) });
    assert.deepEqual([...servers.keys()], ["browse", "imagetooling", "storybook", "open-pencil"]);
    assert.equal(servers.get("browse").disabled, false);
    assert.equal(servers.get("imagetooling").disabled, true);
    assert.equal(servers.has("openseo"), false);
    assert.equal(servers.has("clarity"), false);
  });

  it("mounts imagetooling on the opened project", async () => {
    async function imagetoolingConfig(options) {
      let transform;
      await registerFrontendMcpServers(
        { mcp: { transform: async (callback) => (transform = callback) } },
        options,
        {},
      );
      const servers = new Map();
      transform({ set: (name, config) => servers.set(name, config) });
      return servers.get("imagetooling");
    }

    const fromDirectory = await imagetoolingConfig({
      enabled: true,
      directory: "C:/proj",
    });
    assert.equal(fromDirectory.disabled, false);
    assert.ok(fromDirectory.command.includes("type=bind,src=C:/proj,dst=/workspace"));
  });

  it("rejects server names and passes custom definitions through", async () => {
    assert.throws(
      () =>
        registerFrontendMcpServers(
          { mcp: { transform: async () => {} } },
          { enabled: true, tools: { seo: "openseo" } },
        ),
      /must be a server definition/,
    );

    let transform;
    async function customConfig() {
      await registerFrontendMcpServers(
        { mcp: { transform: async (callback) => (transform = callback) } },
        {
          enabled: true,
          tools: {
            seo: {
              name: "my-seo",
              type: "remote",
              url: "https://example.test/mcp",
              headers: { Authorization: "Bearer user-key" },
            },
          },
        },
        {},
      );
      const servers = new Map();
      transform({ set: (name, config) => servers.set(name, config) });
      return servers;
    }

    const servers = await customConfig();
    assert.deepEqual(servers.get("my-seo").headers, { Authorization: "Bearer user-key" });
    assert.equal(servers.has("openseo"), false);
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

  it("denies other roles MCPs in the permissions it writes to agent frontmatter", () => {
    const remote = { type: "remote", url: "https://example.test/mcp" };
    const permissions = frontendAgentPermissions({
      seo: { ...remote, name: "my-seo" },
      analytics: [
        { ...remote, name: "my-metrics" },
        { ...remote, name: "my-traffic" },
      ],
    });
    const denies = (role, action, resource = "*") =>
      permissions[role].some(
        (rule) => rule.action === action && rule.resource === resource && rule.effect === "deny",
      );
    assert.deepEqual(Object.keys(permissions).sort(), ["analytics", "seo", "ui"]);
    assert.ok(denies("ui", "my-seo_*"));
    assert.ok(denies("seo", "my-metrics_*") && denies("seo", "my-traffic_*"));
    assert.ok(denies("analytics", "storybook_*"));
    assert.ok(denies("ui", "opencode_list_mcp_resources", "my-seo"));
    assert.ok(denies("ui", "opencode_read_mcp_resource", "my-seo:*"));
    assert.ok(!denies("seo", "my-seo_*"));
    assert.ok(!denies("analytics", "my-traffic_*"));
  });
});
