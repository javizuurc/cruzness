import { Plugin } from "@opencode/plugin";
import { registerCruznessMcpServers } from "../../../src/cruzness-config.mjs";

export default Plugin.define({
  id: "cruzness",
  async setup(context) {
    await registerCruznessMcpServers(context);
  },
});
