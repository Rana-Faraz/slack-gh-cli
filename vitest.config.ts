import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
      exclude: [
        "dist/**",
        "src/index.ts",
        "src/platform/desktop-host.ts",
        "src/platform/macos-slack-desktop-host.ts",
        "src/message/default-message-dispatch.ts",
        "src/session/default-desktop-session.ts",
        "src/workspace/current-workspace.ts",
        "test/**",
        "vitest.config.ts",
      ],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        branches: 70,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
    environment: "node",
    include: ["test/**/*.test.ts"],
    restoreMocks: true,
  },
});
