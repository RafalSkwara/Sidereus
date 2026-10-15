/**
 * Factories for the mocks of Astro's and Cloudflare's virtual modules. `vitest.config.ts` deliberately resolves
 * none of them (it is a plain config, see its header), so a test that imports code reaching one of them mocks it
 * with a factory from here. The dynamic import keeps the `vi.mock` factory hoist-safe:
 *
 *   vi.mock("astro:env/server", async () => (await import("@/lib/test-support/virtual-modules")).astroEnvServer({ ... }));
 */

/** `astro:middleware`: `defineMiddleware` hands the handler back, so a test can call `onRequest` directly. */
export function astroMiddleware() {
  return { defineMiddleware: <T>(handler: T): T => handler };
}

/** `astro:env/server`: each key of `values` is a named export, as the generated module exposes the env schema. */
export function astroEnvServer(values: Record<string, unknown> = {}) {
  return { ...values };
}

/** `cloudflare:workers`: `env` is the binding object a test supplies (an empty object when no binding is present). */
export function cloudflareWorkers(env: Record<string, unknown> = {}) {
  return { env };
}
