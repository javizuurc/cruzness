import { Plugin } from "@opencode/plugin";

// Server part: announces the plugin so the CLI loads its TUI part.
export default Plugin.define({
  id: "cruzness.notifications",
  setup() {},
});
