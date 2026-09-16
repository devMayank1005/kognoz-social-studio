import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node"
  },
  // Match how Next compiles the app. Next uses React's automatic JSX runtime, so
  // component files do not import React and do not need to; esbuild's default
  // here is the classic transform, which expects `React` in scope and fails on
  // every one of them. Without this, a .tsx test cannot render a component at
  // all — which is most of why there were none.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./")
    }
  }
});
