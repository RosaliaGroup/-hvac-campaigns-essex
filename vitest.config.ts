import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  // Use React's automatic JSX runtime so component .tsx files render in tests
  // without an explicit `import React` (matches the vite plugin-react build).
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    // Server tests + framework-free client logic (pure helpers, no DOM).
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "client/src/**/*.test.ts", "shared/**/*.test.ts"],
  },
});
