import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/*", "screenshots/*"],
      manifest: {
        id: "./",
        name: "Grind: Structured Strength",
        short_name: "Grind",
        description:
          "Structured full-body workouts with built-in variation, fast logging, and less decision fatigue.",
        display: "standalone",
        scope: "./",
        background_color: "#0E1218",
        theme_color: "#0E1218",
        start_url: "./",
        categories: ["fitness", "health", "lifestyle"],
        icons: [
          {
            src: "icons/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "screenshots/home-narrow.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "Choose a full-body workout",
          },
          {
            src: "screenshots/home-wide.png",
            sizes: "1280x800",
            type: "image/png",
            form_factor: "wide",
            label: "Grind on desktop",
          },
        ],
      },
      workbox: {
        mode: "development",
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,svg,png,webmanifest,woff2}"],
        navigateFallback: "index.html",
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
