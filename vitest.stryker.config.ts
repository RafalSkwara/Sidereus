import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

import baseConfig, { GUARD_FILES } from "./vitest.config";

// Stryker runs the tests against instrumented copies of the source, whose header reads `process.env` and whose
// text differs from the committed files. Tests that scan source text (not behaviour) see Stryker's code there and
// fail, and they cannot kill a mutant anyway, so they stay out of mutation runs. The slow `guards` project too.
const SOURCE_SCANNERS = [
  "src/lib/engine/purity.test.ts",
  "src/components/island-imports.test.ts",
  "src/lib/observability/client/client-imports.test.ts",
  "src/lib/observability/silent-catch-guard.test.ts",
];

export default mergeConfig(
  { ...baseConfig, test: { ...baseConfig.test, projects: undefined } },
  defineConfig({
    test: {
      include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
      exclude: [...configDefaults.exclude, ...GUARD_FILES, ...SOURCE_SCANNERS],
    },
  }),
);
