#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const [exportPath, outputPath, ...options] = process.argv.slice(2);
const values = new Map();
for (let index = 0; index < options.length; index += 2) {
  values.set(options[index], options[index + 1]);
}
const task = values.get("--task");
const promptHash = values.get("--prompt-hash");
const setup = values.get("--setup");
const success = values.get("--success");

try {
  if (
    !exportPath ||
    !outputPath ||
    options.length !== 8 ||
    values.size !== 4 ||
    !task ||
    !promptHash ||
    !["vanilla", "gentleai", "cruzness"].includes(setup) ||
    !["true", "false"].includes(success)
  ) {
    throw new Error(
      "Usage: node scripts/metrics/metrics-import.mjs <opencode-export.json> <runs.json> --task <id> --prompt-hash <hash> --setup <vanilla|gentleai|cruzness> --success <true|false>",
    );
  }

  const exported = JSON.parse(await readFile(exportPath, "utf8"));
  if (!Array.isArray(exported.messages))
    throw new Error("OpenCode export must contain a messages array");

  const role = (message) => message.info?.role ?? message.type;
  const time = (message) => message.info?.time ?? message.time;
  const assistantMessages = exported.messages.filter((message) => role(message) === "assistant");
  if (!assistantMessages.length) throw new Error("OpenCode export has no assistant messages");
  const firstUser = exported.messages.find((message) => role(message) === "user");
  const startedAt = firstUser && time(firstUser)?.created;
  const finishedAt = time(assistantMessages.at(-1))?.completed;
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) {
    throw new Error("OpenCode export is missing valid first-user and final-assistant timestamps");
  }
  const models = new Set();
  let inputTokens = 0;
  let outputTokens = 0;
  for (const message of assistantMessages) {
    const providerID = message.info?.providerID ?? message.model?.providerID;
    const modelID = message.info?.modelID ?? message.model?.id;
    const tokens = message.info?.tokens ?? message.tokens;
    if (!providerID || !modelID)
      throw new Error("Assistant message is missing providerID or modelID");
    models.add(`${providerID}/${modelID}`);
    for (const field of ["input", "output"]) {
      if (!Number.isFinite(tokens?.[field]) || tokens[field] < 0) {
        throw new Error(`Assistant message is missing a valid tokens.${field} value`);
      }
    }
    inputTokens += tokens.input;
    outputTokens += tokens.output;
  }
  if (models.size !== 1)
    throw new Error("OpenCode export contains multiple assistant models; import one model per run");

  const tools = exported.messages.flatMap((message) =>
    (message.parts ?? message.content ?? []).filter((part) => part.type === "tool"),
  );
  const record = {
    task,
    setup,
    model: models.values().next().value,
    promptHash,
    inputTokens,
    outputTokens,
    steps: assistantMessages.length + tools.length,
    durationSeconds: (finishedAt - startedAt) / 1000,
    success: success === "true",
  };
  if (assistantMessages.some((message) => message.type === "assistant")) {
    const delegations = tools.filter((part) => ["task", "subagent"].includes(part.tool));
    const childIDs = delegations.map(
      ({ state }) => state?.metadata?.sessionID ?? state?.metadata?.sessionId,
    );
    record.assistantTurns = assistantMessages.length;
    record.toolCalls = tools.length;
    record.delegationCalls = delegations.length;
    // A sanitized or incomplete result can omit the child ID; do not guess.
    record.subagents = childIDs.every((id) => typeof id === "string" && /^ses_[a-z\d]+$/i.test(id))
      ? new Set(childIDs).size
      : null;
  }
  let records = [];
  try {
    records = JSON.parse(await readFile(outputPath, "utf8"));
    if (!Array.isArray(records)) throw new Error("Metrics output must be a JSON array");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  records.push(record);
  await writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`Imported 1 run to ${outputPath}`);
} catch (error) {
  console.error(`Metrics import failed: ${error.message}`);
  process.exit(1);
}
