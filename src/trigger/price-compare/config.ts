import Anthropic from "@anthropic-ai/sdk";
import type { SheetAccess } from "./sheet.js";

export const DEFAULT_MODEL = "claude-opus-5-5";

export type AiConfig = {
  apiKey: string;
  workspaceId?: string;
  model: string;
  /** Added up over every Claude call in one run, for the Run Log. */
  usage: { calls: number; inputTokens: number; outputTokens: number };
};

/** Claude settings, or null when no API key is set (free-text matching and web research are then off). */
export function aiConfig(): AiConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    // Optional: only needed when ANTHROPIC_API_KEY is an org-level (not workspace-scoped) key.
    workspaceId: process.env.ANTHROPIC_WORKSPACE_ID || undefined,
    model: process.env.PRICE_MODEL || DEFAULT_MODEL,
    usage: { calls: 0, inputTokens: 0, outputTokens: 0 },
  };
}

export function anthropicClient(ai: AiConfig): Anthropic {
  return new Anthropic({ apiKey: ai.apiKey, defaultHeaders: ai.workspaceId ? { "anthropic-workspace-id": ai.workspaceId } : undefined });
}

export function recordUsage(ai: AiConfig, usage: { input_tokens: number; output_tokens: number }): void {
  ai.usage.calls++;
  ai.usage.inputTokens += usage.input_tokens;
  ai.usage.outputTokens += usage.output_tokens;
}

/** True while the weekly check is switched off (a cloud deployment that has been deployed but not started). */
export function isPaused(): boolean {
  return (process.env.PRICE_PAUSED ?? "").trim().toLowerCase() === "true";
}

export function sheetAccess(): SheetAccess {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  if (!serviceAccountJson.trim().startsWith("{")) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must be the whole JSON key file, not the service account email");
  }
  const sheetId = process.env.PRICE_SHEET_ID;
  if (!sheetId) throw new Error("PRICE_SHEET_ID is not set");
  return { serviceAccountJson, sheetId };
}

/** Converts prices between currencies: the value of 1 unit of each currency in the base currency. */
export type FxTable = { base: string; rates: Record<string, number> };

/** Parses FX_RATES ("SGD=0.74,EUR=1.09") into a table; the base currency is always 1. */
export function parseFx(base: string, spec: string): FxTable {
  const rates: Record<string, number> = { [base]: 1 };
  for (const part of spec.split(",")) {
    const [code, value] = part.split("=").map((s) => s.trim());
    const rate = Number(value);
    if (!code || !value) continue;
    if (!(rate > 0)) throw new Error(`FX_RATES: "${part.trim()}" is not a positive rate`);
    rates[code.toUpperCase()] = rate;
  }
  return { base, rates };
}

export function settings() {
  const base = (process.env.BASE_CURRENCY || "USD").trim().toUpperCase();
  const number = (name: string, fallback: number) => {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number(raw);
    if (!(value >= 0)) throw new Error(`${name} must be a number, not "${raw}"`);
    return value;
  };
  return {
    fx: parseFx(base, process.env.FX_RATES ?? ""),
    thresholdPct: number("PRICE_THRESHOLD_PCT", 10),
    cacheTtlHours: number("CACHE_TTL_HOURS", 72),
    includeMock: (process.env.INCLUDE_MOCK_SUPPLIERS ?? "true").trim().toLowerCase() !== "false",
  };
}
