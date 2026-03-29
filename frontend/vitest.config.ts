import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "../tests/frontend/**/*.test.ts",
      "./tests/**/*.test.ts",
      "./tests/**/*.test.tsx",
    ],
    exclude: ["../tests/frontend/**/*.dom.test.ts"],
  },
});
