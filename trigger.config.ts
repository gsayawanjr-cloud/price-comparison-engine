import { existsSync, readFileSync } from "node:fs";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

// Values that must never be shown in the dashboard after upload.
const SECRET_VARS = new Set(["ANTHROPIC_API_KEY", "GOOGLE_SERVICE_ACCOUNT_JSON"]);

/**
 * On a production deploy, uploads the local .env to the production environment so the two never
 * drift. TRIGGER_SECRET_KEY is dev-only. Without a local .env (e.g. CI), nothing is synced.
 */
function productionEnvVars() {
  if (!existsSync(".env")) return undefined;
  const env = Object.fromEntries(
    readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
  );
  // PRICE_PAUSED_PRODUCTION=true deploys the weekly check switched off. Required, so a deploy is
  // never accidentally live.
  if (!["true", "false"].includes((env.PRICE_PAUSED_PRODUCTION ?? "").toLowerCase())) {
    throw new Error("Set PRICE_PAUSED_PRODUCTION=true (deploy switched off) or false (deploy live) in .env before deploying");
  }
  env.PRICE_PAUSED = env.PRICE_PAUSED_PRODUCTION;
  delete env.PRICE_PAUSED_PRODUCTION;
  delete env.TRIGGER_SECRET_KEY;

  return Object.entries(env)
    .filter(([, value]) => value !== "")
    .map(([name, value]) => ({ name, value, isSecret: SECRET_VARS.has(name) }));
}

export default defineConfig({
  // Your project ref from cloud.trigger.dev → Project settings (looks like "proj_abc123").
  // Use a separate Trigger.dev project from the RFQ agent: deploying replaces every task in a project.
  project: "proj_xbsctyhyudjofvztjhqu",
  dirs: ["./src/trigger"],
  maxDuration: 1800,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [syncEnvVars(({ environment }) => (environment === "prod" ? productionEnvVars() : undefined))],
  },
});
