import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type WebSearchMode = "disabled" | "cached" | "live";
type WebSearchContextSize = "low" | "medium" | "high";
type ProviderPayload = Record<string, unknown>;

interface WebSearchConfig {
	enabled: boolean;
	mode: WebSearchMode;
	allowedDomains?: string[];
	contextSize?: WebSearchContextSize;
	userLocation?: {
		country?: string;
		region?: string;
		city?: string;
		timezone?: string;
	};
}

const DEFAULT_CONFIG: WebSearchConfig = {
	enabled: true,
	mode: "cached",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(path: string): unknown {
	if (!existsSync(path)) return undefined;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return undefined;
	}
}

function parseMode(value: unknown): WebSearchMode | undefined {
	if (value === "disabled" || value === "cached" || value === "live") return value;
	return undefined;
}

function parseContextSize(value: unknown): WebSearchContextSize | undefined {
	if (value === "low" || value === "medium" || value === "high") return value;
	return undefined;
}

function parseStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const values = value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	return values.length > 0 ? values : undefined;
}

function parseLocation(value: unknown): WebSearchConfig["userLocation"] {
	if (!isRecord(value)) return undefined;
	const country = typeof value.country === "string" ? value.country.trim() : undefined;
	const region = typeof value.region === "string" ? value.region.trim() : undefined;
	const city = typeof value.city === "string" ? value.city.trim() : undefined;
	const timezone = typeof value.timezone === "string" ? value.timezone.trim() : undefined;
	if (!(country || region || city || timezone)) return undefined;
	return { country, region, city, timezone };
}

function parseConfigFragment(value: unknown): Partial<WebSearchConfig> {
	if (!isRecord(value)) return {};

	return {
		enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
		mode: parseMode(value.mode),
		allowedDomains: parseStringArray(value.allowedDomains),
		contextSize: parseContextSize(value.contextSize),
		userLocation: parseLocation(value.userLocation),
	};
}

function mergeConfig(base: WebSearchConfig, overlay: Partial<WebSearchConfig>): WebSearchConfig {
	return {
		enabled: overlay.enabled ?? base.enabled,
		mode: overlay.mode ?? base.mode,
		allowedDomains: overlay.allowedDomains ?? base.allowedDomains,
		contextSize: overlay.contextSize ?? base.contextSize,
		userLocation: overlay.userLocation ?? base.userLocation,
	};
}

function loadConfig(cwd: string): WebSearchConfig {
	const globalSettingsPath = join(homedir(), ".pi", "agent", "settings.json");
	const projectSettingsPath = join(cwd, ".pi", "settings.json");

	const globalSettings = readJson(globalSettingsPath);
	const projectSettings = readJson(projectSettingsPath);

	const globalFragment = isRecord(globalSettings)
		? parseConfigFragment(globalSettings.extensions?.codexWebSearch)
		: {};
	const projectFragment = isRecord(projectSettings)
		? parseConfigFragment(projectSettings.extensions?.codexWebSearch)
		: {};

	return mergeConfig(mergeConfig(DEFAULT_CONFIG, globalFragment), projectFragment);
}

function buildWebSearchTool(config: WebSearchConfig): Record<string, unknown> {
	const tool: Record<string, unknown> = {
		type: "web_search",
		external_web_access: config.mode === "live",
	};

	if (config.allowedDomains && config.allowedDomains.length > 0) {
		tool.filters = {
			allowed_domains: config.allowedDomains,
		};
	}

	if (config.contextSize) {
		tool.search_context_size = config.contextSize;
	}

	if (config.userLocation) {
		tool.user_location = {
			type: "approximate",
			...config.userLocation,
		};
	}

	return tool;
}

function hasWebSearchTool(tools: unknown): boolean {
	if (!Array.isArray(tools)) return false;

	return tools.some((tool) => {
		if (!isRecord(tool)) return false;
		const type = tool.type;
		return type === "web_search" || type === "web_search_2025_08_26";
	});
}

function isCodexModel(model: { provider: string; api?: string } | undefined): boolean {
	if (!model) return false;
	if (model.provider === "openai-codex") return true;
	if (model.api === "openai-codex-responses") return true;
	return false;
}

export default function (pi: ExtensionAPI) {
	let config: WebSearchConfig | undefined;

	pi.on("session_start", async (_event, ctx) => {
		config = loadConfig(ctx.cwd);
	});

	pi.on("before_provider_request", async (event, ctx) => {
		if (!config) config = loadConfig(ctx.cwd);
		if (!config.enabled || config.mode === "disabled") return;
		if (!isCodexModel(ctx.model)) return;
		if (!ctx.model) return;

		const codexCredential = ctx.modelRegistry.authStorage.get("openai-codex");
		if (!codexCredential || codexCredential.type !== "oauth") return;

		const codexApiKey = await ctx.modelRegistry.getApiKeyForProvider("openai-codex");
		if (!codexApiKey) return;

		if (!isRecord(event.payload)) return;
		const payload = event.payload as ProviderPayload;
		if (hasWebSearchTool(payload.tools)) return;

		const tools = Array.isArray(payload.tools) ? [...payload.tools] : [];
		tools.push(buildWebSearchTool(config));

		return {
			...payload,
			tools,
		};
	});
}
