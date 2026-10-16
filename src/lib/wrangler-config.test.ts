import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// error-visibility Phase 1: the settings that make production failures visible live only in `wrangler.jsonc`, and a
// dashboard switch is turned off by the next deploy. Deleting one of them (for example to silence a warning from an
// older wrangler) must fail CI, not quietly switch Issues off.

function readWranglerConfig(): Record<string, unknown> {
  const text = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
  const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", text);
  if (parsed.error) {
    throw new Error(
      `wrangler.jsonc does not parse: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, "\n")}`,
    );
  }
  return parsed.config as Record<string, unknown>;
}

describe("wrangler.jsonc pins the observability settings", () => {
  const config = readWranglerConfig();
  const observability = (config.observability ?? {}) as Record<string, unknown>;

  it("keeps Workers Issues on, so a logged error becomes an Issue", () => {
    expect(observability.issues).toEqual({ enabled: true });
  });

  it("keeps the invocation event off while our own console lines stay on", () => {
    // The invocation event stores the whole `request.cf` of every visitor (latitude, longitude, city, postal code,
    // region: IP-derived location, no redaction option), found in production on 2026-10-16. Turning it back on stores
    // visitor location again; deleting the `logs` block would too, since the event is on by default.
    expect(observability.logs).toEqual({ enabled: true, invocation_logs: false });
  });

  it("keeps the query string out of logs and traces, because it carries site coordinates", () => {
    expect(observability.redact_query_string).toBe(true);
  });

  it("keeps Version URLs off, so no uploaded Worker version has a public URL", () => {
    // Off since the probe ended (owner, 2026-10-15). Pinned in the file so a CI deploy cannot switch them back on.
    expect(config.preview_urls).toBe(false);
  });
});
