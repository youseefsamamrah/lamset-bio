import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function normalizeBase(value: string | undefined) {
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig({
  plugins: [react()],
  base: normalizeBase(process.env.PAGES_BASE_PATH),
  publicDir: "public",
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
  },
});
