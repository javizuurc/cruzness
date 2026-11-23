const roles = ["seo", "analytics", "ui"];
const builtins = ["browse", "imagetooling", "storybook", "open-pencil"];

const browseBase = {
  type: "local",
  command: ["npx", "-y", "@opencode/browse", "mcp"],
  disabled: false,
};

const imagetoolingBase = {
  type: "local",
  command: [
    "docker",
    "run",
    "-i",
    "--rm",
    "--workdir",
    "/workspace",
    "--mount",
    "type=bind,src=__PROJECT_DIRECTORY__,dst=/workspace",
    "imagetooling",
  ],
  disabled: false,
};

const storybook = {
  type: "local",
  command: ["npx", "-y", "storybook-mcp@0.5.1"],
  environment: { STORYBOOK_URL: "http://localhost:6006/index.json" },
  disabled: false,
};
const openPencil = {
  type: "local",
  command: ["npx", "-y", "@open-pencil/mcp"],
  disabled: false,
};

function imagetoolingConfig(projectRoot) {
  if (!projectRoot) return { ...imagetoolingBase, disabled: true };
  return {
    ...imagetoolingBase,
    command: imagetoolingBase.command.map((arg) =>
      arg === "type=bind,src=__PROJECT_DIRECTORY__,dst=/workspace"
        ? `type=bind,src=${projectRoot},dst=/workspace`
        : arg,
    ),
    disabled: false,
  };
}

export function normalizeFrontendTools(tools = {}, reserved = []) {
  if (typeof tools !== "object" || Array.isArray(tools) || tools === null) {
    throw new TypeError("frontendTools must be a YAML mapping");
  }
  const reservedNames = [...builtins, ...reserved];
  const usedNames = new Set();
  const overlap = (a, b) => a === b || a.startsWith(`${b}_`) || b.startsWith(`${a}_`);
  for (const [role, value] of Object.entries(tools)) {
    if (!roles.includes(role)) {
      throw new TypeError(`unknown frontendTools role "${role}" (known: ${roles.join(", ")})`);
    }
    if (role === "seo" && Array.isArray(value)) {
      throw new TypeError("frontendTools.seo must be a single server definition");
    }
    if (Array.isArray(value) && !value.length) {
      throw new TypeError(`frontendTools.${role} must not be empty`);
    }
    for (const entry of Array.isArray(value) ? value : [value]) {
      validateDefinition(role, entry);
      const name = entry.name ?? role;
      if (typeof name !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
        throw new TypeError(
          `frontendTools.${role} name must use lowercase letters, digits, hyphens or underscores`,
        );
      }
      if (reservedNames.some((other) => overlap(name, other))) {
        throw new TypeError(
          `frontendTools.${role} uses a reserved MCP name or tool prefix: ${name}`,
        );
      }
      if ([...usedNames].some((other) => overlap(name, other))) {
        throw new TypeError(
          `frontendTools.${role} uses a duplicate or overlapping MCP name: ${name}`,
        );
      }
      usedNames.add(name);
    }
  }
  return tools;
}

function validateDefinition(role, value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`frontendTools.${role} must be a server definition, or an array of those`);
  }
  const { type, url, command } = value;
  if (type !== "remote" && type !== "local") {
    throw new TypeError(`frontendTools.${role} definition must have type "remote" or "local"`);
  }
  if (type === "remote" && (typeof url !== "string" || !url.trim())) {
    throw new TypeError(`frontendTools.${role} remote definition must have a url string`);
  }
  if (
    type === "local" &&
    (!Array.isArray(command) ||
      !command.length ||
      !command[0] ||
      command.some((arg) => typeof arg !== "string"))
  ) {
    throw new TypeError(
      `frontendTools.${role} local definition must have a non-empty command array of strings`,
    );
  }
}

function* customServers(tools) {
  for (const role of roles) {
    const value = tools[role];
    if (value === undefined) continue;
    for (const { name = role, ...config } of Array.isArray(value) ? value : [value]) {
      yield { role, name: name ?? role, config };
    }
  }
}

// Role isolation can only land where OpenCode reads it before runtime: agent
// frontmatter. A plugin transform never sees file-based agents, because they
// register after every plugin setup.
export function frontendAgentPermissions(tools = {}) {
  const servers = [
    ...customServers(normalizeFrontendTools(tools)),
    ...builtins.map((name) => ({ name, role: "ui" })),
  ];
  const permissions = {};
  for (const role of roles) {
    permissions[role] = servers
      .filter((server) => server.role !== role)
      .flatMap(({ name }) => [
        { action: `${name}_*`, resource: "*", effect: "deny" },
        { action: "opencode_list_mcp_resources", resource: name, effect: "deny" },
        { action: "opencode_read_mcp_resource", resource: `${name}:*`, effect: "deny" },
      ]);
  }
  return permissions;
}

export const frontendAgentIds = ["frontend/ui", "frontend/seo", "frontend/analytics"];

// Vendored + on-demand frontend skills. Keep in sync with
// frontend/skills/REGISTRY.md, frontend/skills-lock.json and `impeccable`
// (copied manually on demand, outside the lock).
export const frontendSkillIds = [
  "frontend-design",
  "design-taste-frontend",
  "impeccable",
  "make-interfaces-feel-better",
  "transitions-dev",
  "transitions-polish",
  "gsap-core",
  "gsap-frameworks",
  "gsap-performance",
  "gsap-plugins",
  "gsap-react",
  "gsap-scrolltrigger",
  "gsap-timeline",
  "gsap-utils",
  "modern-web-guidance",
];

export function registerFrontendMcpServers(context, options = {}) {
  const { enabled = false, tools = {}, directory } = options;
  if (!enabled) return;
  if (options.servers !== undefined) {
    throw new TypeError("frontend_mcp was replaced by frontendTools (rol -> servidor/definicion)");
  }

  const servers = [...customServers(normalizeFrontendTools(tools))];
  return context.mcp.transform((editor) => {
    for (const { name } of servers) {
      if (editor.get?.(name)) throw new TypeError(`MCP server already registered: ${name}`);
    }
    for (const { name, config } of servers) {
      editor.set(name, config);
    }
    editor.set("browse", { ...browseBase });
    editor.set("imagetooling", imagetoolingConfig(directory));
    editor.set("storybook", { ...storybook });
    editor.set("open-pencil", { ...openPencil });
  });
}
