import { JevConfigError } from "./errors.js";

export type JevConfig = {
  apiKey: string;
  model: string;
  baseURL: string | undefined;
  mock: boolean;
  autoAccept: number;
  reviewAt: number;
  blockAt: number;
  trustedAdapterIds: string[];
};

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return fallback;
  }
  return value;
}

function boolEnv(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function trustedAdaptersEnv(): string[] {
  return (process.env.JEV_MCP_TRUSTED_ADAPTERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getConfig(): JevConfig {
  const config: JevConfig = {
    apiKey: process.env.TYPESAFE_API_KEY?.trim() ?? "",
    model: process.env.JEV_MCP_MODEL?.trim() || "jev-latest",
    baseURL: process.env.TYPESAFE_BASE_URL?.trim() || undefined,
    mock: boolEnv("JEV_MCP_MOCK"),
    autoAccept: numEnv("JEV_MCP_AUTO_ACCEPT", 0.8),
    reviewAt: numEnv("JEV_MCP_REVIEW_AT", 0.5),
    blockAt: numEnv("JEV_MCP_BLOCK_AT", 0.75),
    trustedAdapterIds: trustedAdaptersEnv(),
  };
  if (config.reviewAt > config.autoAccept) throw new JevConfigError("JEV_MCP_REVIEW_AT must be <= JEV_MCP_AUTO_ACCEPT");
  if (config.reviewAt > config.blockAt) throw new JevConfigError("JEV_MCP_REVIEW_AT must be <= JEV_MCP_BLOCK_AT");
  return config;
}
