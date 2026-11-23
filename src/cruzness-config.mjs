import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { normalizeFrontendTools } from "./frontend-config.mjs";

export {
  frontendAgentIds,
  frontendAgentPermissions,
  frontendSkillIds,
  normalizeFrontendTools,
  registerFrontendMcpServers,
} from "./frontend-config.mjs";

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
    if (error.code === "ENOENT") {
      return {
        notifications: { task_complete: false },
        frontend: false,
        frontendTools: {},
      };
    }
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

  const frontend = config.frontend ?? false;
  if (typeof frontend !== "boolean") {
    throw new TypeError("frontend must be a boolean");
  }

  // Optional role overrides: solo con sentido cuando frontend es true.
  if (config.frontend_mcp !== undefined) {
    throw new TypeError("frontend_mcp was replaced by frontendTools (rol -> servidor/definicion)");
  }
  const frontendTools = normalizeFrontendTools(config.frontendTools ?? {}, Object.keys(mcpServers));

  return {
    notifications: { task_complete: taskComplete },
    frontend,
    frontendTools,
  };
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
