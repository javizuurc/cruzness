import { Plugin } from "@opencode/plugin";
import { readCruznessConfig, registerFrontendMcpServers } from "../../src/cruzness-config.mjs";

export default Plugin.define({
  id: "cruzness.frontend",
  async setup(context) {
    const location = context.location;
    if (!location?.directory) return;

    const config = await readCruznessConfig(location.directory);
    if (!config.frontend) return;

    await registerFrontendMcpServers(context, {
      enabled: config.frontend,
      tools: config.frontendTools,
      directory: location.directory,
    });
  },
});
