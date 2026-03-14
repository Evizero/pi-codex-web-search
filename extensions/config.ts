import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";

export type WebSearchMode = "disabled" | "cached" | "live";
export type WebSearchContextSize = "low" | "medium" | "high";

export interface WebSearchLocation {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

export interface WebSearchConfig {
  mode: WebSearchMode;
  allowedDomains?: string[];
  contextSize?: WebSearchContextSize;
  location?: WebSearchLocation;
}

interface ConfigFragment {
  mode?: WebSearchMode;
  allowedDomains?: string[];
  contextSize?: WebSearchContextSize;
  location?: WebSearchLocation;
}

export interface LoadedConfig {
  config: WebSearchConfig;
  warnings: string[];
}

const DEFAULT_CONFIG: WebSearchConfig = {
  mode: "cached",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonFile(path: string, warnings: string[]): unknown {
  if (!existsSync(path)) return undefined;

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`could not parse ${path}: ${message}`);
    return undefined;
  }
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseMode(value: unknown): WebSearchMode | undefined {
  if (value === "disabled" || value === "cached" || value === "live")
    return value;
  return undefined;
}

function parseContextSize(value: unknown): WebSearchContextSize | undefined {
  if (value === "low" || value === "medium" || value === "high") return value;
  return undefined;
}

function parseAllowedDomains(
  value: unknown,
  warnings: string[],
  source: string,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    warnings.push(`${source}.allowed_domains must be an array of strings`);
    return undefined;
  }

  const domains: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      warnings.push(`${source}.allowed_domains ignores non-string entry`);
      continue;
    }
    const trimmed = item.trim();
    if (trimmed.length > 0) domains.push(trimmed);
  }

  return domains;
}

function parseLocation(
  value: unknown,
  warnings: string[],
  source: string,
): WebSearchLocation | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    warnings.push(`${source}.location must be an object`);
    return undefined;
  }

  const location: WebSearchLocation = {
    country: readString(value.country),
    region: readString(value.region),
    city: readString(value.city),
    timezone: readString(value.timezone),
  };

  if (
    location.country ||
    location.region ||
    location.city ||
    location.timezone
  ) {
    return location;
  }

  return undefined;
}

function parseConfigFragment(
  value: unknown,
  warnings: string[],
  source: string,
): ConfigFragment {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    warnings.push(`${source} config must be a JSON object`);
    return {};
  }

  const mode = parseMode(value.mode);
  if (value.mode !== undefined && !mode) {
    warnings.push(`${source}.mode must be one of: disabled, cached, live`);
  }

  const contextSize = parseContextSize(value.context_size);
  if (value.context_size !== undefined && !contextSize) {
    warnings.push(`${source}.context_size must be one of: low, medium, high`);
  }

  return {
    mode,
    allowedDomains: parseAllowedDomains(
      value.allowed_domains,
      warnings,
      source,
    ),
    contextSize,
    location: parseLocation(value.location, warnings, source),
  };
}

function mergeLocation(
  base?: WebSearchLocation,
  overlay?: WebSearchLocation,
): WebSearchLocation | undefined {
  if (!base) return overlay;
  if (!overlay) return base;

  const merged: WebSearchLocation = {
    country: overlay.country ?? base.country,
    region: overlay.region ?? base.region,
    city: overlay.city ?? base.city,
    timezone: overlay.timezone ?? base.timezone,
  };

  return merged.country || merged.region || merged.city || merged.timezone
    ? merged
    : undefined;
}

function mergeConfig(
  base: WebSearchConfig,
  overlay: ConfigFragment,
): WebSearchConfig {
  return {
    mode: overlay.mode ?? base.mode,
    allowedDomains:
      overlay.allowedDomains !== undefined
        ? overlay.allowedDomains
        : base.allowedDomains,
    contextSize: overlay.contextSize ?? base.contextSize,
    location: mergeLocation(base.location, overlay.location),
  };
}

export function loadConfig(cwd: string): LoadedConfig {
  const warnings: string[] = [];
  const globalPath = join(getAgentDir(), "extensions", "codex-web-search.json");
  const projectPath = join(cwd, ".pi", "extensions", "codex-web-search.json");

  const globalConfig = parseConfigFragment(
    readJsonFile(globalPath, warnings),
    warnings,
    globalPath,
  );
  const projectConfig = parseConfigFragment(
    readJsonFile(projectPath, warnings),
    warnings,
    projectPath,
  );

  return {
    config: mergeConfig(
      mergeConfig(DEFAULT_CONFIG, globalConfig),
      projectConfig,
    ),
    warnings,
  };
}
