#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const [action, ...args] = process.argv.slice(2);

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function projectRoot() {
  const root = resolve(git(["rev-parse", "--show-toplevel"]));
  if (resolve(process.cwd()) !== root) throw new Error("Run the timer from the project root");
  return root;
}

function outsideProject(file, root) {
  const path = resolve(file);
  const pathFromRoot = relative(root, path);
  if (
    !isAbsolute(pathFromRoot) &&
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..\\`) &&
    !pathFromRoot.startsWith("../")
  ) {
    throw new Error("Timer state and results must be stored outside the project");
  }
  return path;
}

function rootIdentity(root) {
  const normalized = process.platform === "win32" ? root.toLowerCase() : root;
  return createHash("sha256").update(normalized).digest("hex");
}

function usage() {
  throw new Error(
    "Usage: node scripts/metrics/setup-timer.mjs start <state.json> <vanilla|gentleai|cruzness> | stop <state.json> <setup-times.json>",
  );
}

try {
  const root = projectRoot();
  const head = git(["rev-parse", "HEAD"]);
  if (action === "start" && args.length === 2) {
    const [statePath, setup] = args;
    if (!["vanilla", "gentleai", "cruzness"].includes(setup)) {
      throw new Error("Setup must be vanilla, gentleai, or cruzness");
    }
    if (git(["status", "--porcelain", "--untracked-files=all"])) {
      throw new Error("Start from a clean clone with no tracked or untracked changes");
    }
    const stateFile = outsideProject(statePath, root);
    const state = {
      id: randomUUID(),
      setup,
      startedAt: Date.now(),
      root: rootIdentity(root),
      head,
    };
    await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, { flag: "wx" });
    console.log("Setup timer started. Stop after the baseline is working.");
  } else if (action === "stop" && args.length === 2) {
    const [statePath, resultsPath] = args;
    const stateFile = outsideProject(statePath, root);
    const resultsFile = outsideProject(resultsPath, root);
    const state = JSON.parse(await readFile(stateFile, "utf8"));
    if (state.root !== rootIdentity(root) || state.head !== head) {
      throw new Error("Stop from the same project and commit used to start the timer");
    }
    let results = { runs: [] };
    try {
      results = JSON.parse(await readFile(resultsFile, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (!Array.isArray(results.runs)) throw new Error("Setup results must contain a runs array");
    if (!Number.isFinite(state.startedAt) || state.startedAt > Date.now()) {
      throw new Error("Timer state has an invalid start time");
    }
    const existingRun = results.runs.find((run) => run.id === state.id);
    let minutes = state.minutes ?? existingRun?.minutes;
    if (minutes === undefined) {
      minutes = (Date.now() - state.startedAt) / 60000;
    }
    if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0) {
      throw new Error("Timer state has an invalid elapsed time");
    }
    if (state.minutes === undefined) {
      if (!existingRun) results.runs.push({ id: state.id, setup: state.setup, minutes });
      await writeFile(resultsFile, `${JSON.stringify(results, null, 2)}\n`);
      await writeFile(
        stateFile,
        `${JSON.stringify({ ...state, finishedAt: Date.now(), minutes }, null, 2)}\n`,
      );
    } else if (!existingRun) {
      throw new Error("Completed timer result is missing from setup results");
    }
    console.log(JSON.stringify({ setupMinutes: minutes }));
  } else {
    usage();
  }
} catch (error) {
  console.error(`Setup timer failed: ${error.message}`);
  process.exit(1);
}
