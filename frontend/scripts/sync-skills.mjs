#!/usr/bin/env node
/**
 * Install or update the frontend external skills from their origin repos.
 *
 * Source of truth: `frontend/skills-lock.json` (same shape as the lock file
 * in the origin project). Each entry re-runs the documented
 * `npx skills add <repo-url> --skill <name>`, so every run converges to the
 * repos' current HEAD. The CLI installs under `.agents/skills/`; OpenCode only
 * scans `.opencode/`, so each install is copied there too. Vendored wrappers
 * (`frontend-design`, `design-taste-frontend`) come from
 * `sync-frontend.mjs` and are never touched here.
 *
 * Usage:
 *   node frontend/scripts/sync-skills.mjs            # install/update all
 *   node frontend/scripts/sync-skills.mjs --dry-run  # print only
 */
import { execFile } from "node:child_process";
import { cp, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function readSkillsLock(lockPath = path.join(root, "frontend", "skills-lock.json")) {
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  return lock.skills ?? {};
}

export function buildInstallCommands(skills) {
  return Object.entries(skills).map(([name, entry]) => ({
    name,
    source: entry.source,
    command: [
      "npx",
      "-y",
      "skills",
      "add",
      `https://github.com/${entry.source}`,
      "--skill",
      name,
      "--agent",
      "opencode",
      "--copy",
      "--yes",
    ],
  }));
}

export async function copyInstalledSkills(names, directory = root) {
  for (const name of names) {
    const installed = path.join(directory, ".agents", "skills", name);
    const target = path.join(directory, ".opencode", "skills", name);
    const staging = `${target}.tmp`;
    // Stage first: a failed copy must not destroy a previous install.
    await rm(staging, { recursive: true, force: true });
    await cp(installed, staging, { recursive: true });
    await rm(target, { recursive: true, force: true });
    await rename(staging, target);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skills = await readSkillsLock();
  const commands = buildInstallCommands(skills);

  for (const { name, command } of commands) {
    if (dryRun) {
      console.log(`[dry-run] ${name}: ${command.join(" ")}`);
      console.log(`[dry-run] ${name}: copy .agents/skills/${name} -> .opencode/skills/${name}`);
      continue;
    }
    console.log(`${name}: ${command.join(" ")}`);
    // Invoke the npm entrypoint directly on Windows: npx.cmd needs a shell.
    const [executable, ...args] =
      process.platform === "win32"
        ? [
            process.execPath,
            path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"),
            ...command.slice(1),
          ]
        : command;
    await execFileAsync(executable, args, { cwd: root });
    await copyInstalledSkills([name]);
  }
  console.log(`done: ${commands.length} skills`);
}

const invoked =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) await main();
