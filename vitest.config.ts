// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["modules/**/*.test.ts", "lib/**/*.test.ts"],
    globals: false,
    // Dummy env-vars zodat module-imports (lib/db/client, lib/ai/claude)
    // niet falen bij init. Tests mocken alle externe calls, dus deze
    // waarden worden nooit gebruikt voor echte connecties.
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      ANTHROPIC_API_KEY: "sk-ant-test-key-1234567890abcdef",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
