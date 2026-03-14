import {
  type ExtensionAPI,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { loadConfig, type LoadedConfig } from "./config.js";
import { isCodexModel, patchProviderPayload } from "./web-search.js";

function reportWarnings(ctx: ExtensionContext, warnings: string[]) {
  for (const warning of warnings) {
    console.warn(`[codex-web-search] ${warning}`);
    if (ctx.hasUI) {
      ctx.ui.notify(`codex-web-search: ${warning}`, "warning");
    }
  }
}

export default function (pi: ExtensionAPI) {
  let loadedConfig: LoadedConfig | undefined;

  pi.on("session_start", async (_event, ctx) => {
    loadedConfig = loadConfig(ctx.cwd);
    reportWarnings(ctx, loadedConfig.warnings);
  });

  pi.on("before_provider_request", async (event, ctx) => {
    if (!loadedConfig) {
      loadedConfig = loadConfig(ctx.cwd);
    }

    const config = loadedConfig.config;
    if (config.mode === "disabled") return;
    if (!ctx.model || !isCodexModel(ctx.model)) return;

    const codexCredential = ctx.modelRegistry.authStorage.get("openai-codex");
    if (!codexCredential || codexCredential.type !== "oauth") return;

    const codexApiKey =
      await ctx.modelRegistry.getApiKeyForProvider("openai-codex");
    if (!codexApiKey) return;

    return patchProviderPayload(event.payload, config);
  });
}
