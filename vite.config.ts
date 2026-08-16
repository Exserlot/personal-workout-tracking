import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig(() => {
  const sentryBuildEnabled = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        includeAssets: ["form-mark.svg", "apple-touch-icon-180x180.png"],
        manifest: {
          name: "FORM — Personal Workout Tracker",
          short_name: "FORM",
          description: "Personal Workout Tracking App สำหรับวางแผน บันทึก และทบทวนการฝึก",
          lang: "th",
          start_url: "/today",
          scope: "/",
          display: "standalone",
          background_color: "#0e0f11",
          theme_color: "#0e0f11",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
          navigateFallback: "index.html",
          globPatterns: ["**/*.{html,js,css,woff,woff2,svg,png,ico}"],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          runtimeCaching: [],
        },
      }),
      ...(sentryBuildEnabled
        ? [sentryVitePlugin({
            authToken: process.env.SENTRY_AUTH_TOKEN,
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            release: { name: process.env.VITE_APP_VERSION },
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
            telemetry: false,
          })]
        : []),
    ],
    build: {
      sourcemap: sentryBuildEnabled ? "hidden" : false,
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/@sentry")) return "vendor-sentry";
            if (id.includes("node_modules/react-router")) return "vendor-router";
            if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "vendor-react";
            return undefined;
          },
        },
      },
    },
  };
});
