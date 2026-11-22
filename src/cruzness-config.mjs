import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const mcpServers = {
  "context-mode": {
    command: ["npx", "-y", "context-mode", "server", "--agent", "opencode"],
    type: "local",
  },
  context7: {
    type: "remote",
    url: "https://mcp.context7.com/mcp",
  },
  github: {
    type: "remote",
    url: "https://api.githubcopilot.com/mcp/",
    oauth: false,
  },
  "codebase-memory": {
    type: "local",
    command: ["npx", "-y", "codebase-memory-mcp"],
  },
  mermaid: {
    type: "local",
    command: ["npx", "-y", "@fay-i/mermaid-mcp", "./data/mermaid-artifacts"],
    environment: { STORAGE_TYPE: "local" },
  },
};

export function registerCruznessMcpServers(context, environment = process.env) {
  const githubAuth = environment.GITHUB_PERSONAL_ACCESS_TOKEN;
  const servers = {
    ...mcpServers,
    github: {
      ...mcpServers.github,
      ...(githubAuth ? { headers: { Authorization: `Bearer ${githubAuth}` } } : { disabled: true }),
    },
  };

  return context.mcp.transform((editor) => {
    for (const [name, config] of Object.entries(servers)) {
      editor.set(name, config);
    }
  });
}

export async function readCruznessConfig(directory) {
  let source;
  try {
    source = await readFile(path.join(directory, "cruzness.yml"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { notifications: { task_complete: false } };
    throw error;
  }

  const config = parse(source) ?? {};
  if (typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("cruzness.yml must contain a YAML mapping");
  }

  const notifications = config.notifications ?? {};
  if (typeof notifications !== "object" || Array.isArray(notifications)) {
    throw new TypeError("notifications must be a YAML mapping");
  }

  const taskComplete = notifications.task_complete ?? false;
  if (typeof taskComplete !== "boolean") {
    throw new TypeError("notifications.task_complete must be a boolean");
  }

  return { notifications: { task_complete: taskComplete } };
}

export function registerTaskCompletionNotification(context, enabled) {
  if (!enabled) return;

  return context.data.on("session.execution.succeeded", () =>
    context.attention.notify({
      title: "CruzNess",
      message: "Task completed",
      notification: { when: "blurred" },
    }),
  );
}
