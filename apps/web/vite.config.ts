import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the web app runs on Vite (port 3000) and proxies the API (`/v1`) to the API process, so the
// browser sees one origin exactly as in production, where the API process serves the built files itself.
const apiTarget = `http://127.0.0.1:${process.env.API_PORT ?? "3001"}`;
const proxy = { "/v1": { target: apiTarget, changeOrigin: false } };
// IPv4 loopback explicitly: on Windows "localhost" may bind IPv6 only, which some VPNs, firewalls and sandboxes
// refuse. Browsers opening http://localhost:3000 fall back to 127.0.0.1 transparently.
const host = "127.0.0.1";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  css: {
    modules: { localsConvention: "camelCaseOnly" },
    preprocessorOptions: {
      // `@use "mixins" as *;` and `@use "tokens";` resolve from src/styles in every module.
      scss: { loadPaths: [fileURLToPath(new URL("./src/styles", import.meta.url))] },
    },
  },
  server: { host, port: 3000, strictPort: true, proxy },
  preview: { host, port: 3000, strictPort: true, proxy },
  build: {
    target: "es2022",
    sourcemap: true,
    // Fonts and icons are small; inlining them would only defeat caching.
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        // Stable vendor chunks: they change only when dependencies do, so returning visitors keep them cached
        // across app releases. Everything else is split per route automatically.
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "tanstack", test: /node_modules[\\/]@tanstack[\\/]/ },
          ],
        },
      },
    },
  },
});
