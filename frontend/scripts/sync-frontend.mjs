#!/usr/bin/env node
/**
 * Materialize the optional frontend package into the project's OpenCode tree.
 *
 * OpenCode registers file-based agents and skills after every plugin setup, and
 * `ctx.agent.transform` can neither add nor see them. So `cruzness.yml` cannot
 * add or hide them from a plugin; this script owns that:
 *   - frontend: true  -> copies the agents (with per-role MCP denials in their
 *                        frontmatter) and the vendored skills into `.opencode/`.
 *   - frontend: false -> removes what it wrote.
 *
 * Sources live in `frontend/agents/` and `frontend/skills/`. Re-run it after
 * editing `cruzness.yml`; the plugin only registers MCP servers at runtime.
 *
 * Usage:
 *   node frontend/scripts/sync-frontend.mjs              # apply
 *   node frontend/scripts/sync-frontend.mjs --dry-run    # print only
 *   node frontend/scripts/sync-frontend.mjs --project .  # other project root
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import { frontendAgentPermissions, frontendSkillIds, readCruznessConfig } from "../../src/cruzness-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(root, "frontend");
const agentRoles = ["ui", "seo", "analytics"];

export async function vendoredSkills(directory = source) {
  const entries = await readdir(path.join(directory, "skills"), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function withPermissions(markdown, permissions) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(markdown);
  const data = (match ? parse(match[1]) : null) ?? {};
  data.permissions = permissions;
  const body = (match ? markdown.slice(match[0].length) : markdown).replace(/^\r?\n+/, "");
  return `---\n${stringify(data)}---\n\n${body}`;
}

async function writeIfChanged(target, content, { dryRun, directory, log }) {
  const current = await readFile(target, "utf8").catch(() => undefined);
  const action = current === content ? "unchanged" : current === undefined ? "created" : "updated";
  log(`${dryRun ? "[dry-run] " : ""}${action}: ${path.relative(directory, target)}`);
  if (dryRun || action === "unchanged") return;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

export async function syncFrontend({
  directory = root,
  enabled,
  tools = {},
  dryRun = false,
  log = console.log,
} = {}) {
  const skills = await vendoredSkills();
  const targets = [
    path.join(directory, ".opencode", "agents", "frontend"),
    ...frontendSkillIds.map((id) => path.join(directory, ".opencode", "skills", id)),
  ];

  if (!enabled) {
    for (const target of targets) {
      log(`${dryRun ? "[dry-run] " : ""}removed: ${path.relative(directory, target)}`);
      if (!dryRun) await rm(target, { recursive: true, force: true });
    }
    return { enabled: false, files: 0 };
  }

  const permissions = frontendAgentPermissions(tools);
  let files = 0;
  for (const role of agentRoles) {
    const target = path.join(directory, ".opencode", "agents", "frontend", `${role}.md`);
    const markdown = await readFile(path.join(source, "agents", `${role}.md`), "utf8");
    await writeIfChanged(target, withPermissions(markdown, permissions[role] ?? []), {
      dryRun,
      directory,
      log,
    });
    files += 1;
  }
  for (const id of skills) {
    const target = path.join(directory, ".opencode", "skills", id, "SKILL.md");
    const markdown = await readFile(path.join(source, "skills", id, "SKILL.md"), "utf8");
    await writeIfChanged(target, markdown, { dryRun, directory, log });
    files += 1;
  }
  return { enabled: true, files };
}

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--project");
  const directory = index === -1 ? root : path.resolve(args[index + 1]);
  const config = await readCruznessConfig(directory);
  const result = await syncFrontend({
    directory,
    enabled: config.frontend,
    tools: config.frontendTools,
    dryRun: args.includes("--dry-run"),
  });
  const prefix = args.includes("--dry-run") ? "[dry-run] " : "";
  console.log(
    result.enabled
      ? `${prefix}frontend enabled: ${result.files} files under ${path.relative(root, directory) || "."}`
      : `${prefix}frontend disabled: agents and frontend skills removed`,
  );
}

const invoked =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) await main();
