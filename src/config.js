const appVersion =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "development";

export const DEFAULT_CONFIG = {
  versionLabel: `v${appVersion}`,
  webhookUrl: "YOUR_N8N_WEBHOOK_URL",
  dryRun: true,
};
