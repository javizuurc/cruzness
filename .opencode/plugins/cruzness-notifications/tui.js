import { Plugin } from "@opencode/plugin/tui";
import {
  readCruznessConfig,
  registerTaskCompletionNotification,
} from "../../../src/cruzness-config.mjs";

export default Plugin.define({
  id: "cruzness.notifications.tui",
  async setup(context) {
    const location = context.location ?? context.data.location.default();
    if (!location?.directory) return;

    const config = await readCruznessConfig(location.directory);
    return registerTaskCompletionNotification(context, config.notifications.task_complete);
  },
});
