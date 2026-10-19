import { z } from "zod";

import { CLIENT_STEPS, NAME_SHAPE } from "@/lib/observability/client/steps";
import type { ClientReport } from "@/lib/observability/client/reporter";
import { logNotice } from "@/lib/observability/log-failure";

/**
 * The server side of `POST /api/client-error` (error-visibility, Phase 7): reading a bounded body, the strict schema
 * of a report and the one line an accepted report becomes. The route (`src/pages/api/client-error.ts`) orders the
 * checks; nothing here reads a cookie, `locals` or the database.
 */

/** The most a report may weigh: a step and a name are far below it, so anything larger is not a report. */
export const MAX_REPORT_BYTES = 512;

/**
 * The body as text, or `null` when it is over `maxBytes`. A `Content-Length` over the limit is refused without reading;
 * the stream is then read with a running byte count that stops at the first byte past the limit, so a chunked body
 * with no `Content-Length` is bounded the same way and a large forgery is never held in memory.
 */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > maxBytes) {
    return null;
  }
  if (request.body === null) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * The strict shape of a report: a step of the closed list and, optionally, a name of `NAME_SHAPE`. An unknown key (a
 * `code`, a `source`, a `message`) is refused, so a report can never carry more than the reporter sends.
 */
const reportSchema = z.strictObject({
  step: z.enum(CLIENT_STEPS),
  name: z.string().regex(NAME_SHAPE).optional(),
});

/** The report in `text`, or `undefined` when it is not JSON or does not match the schema. */
export function parseClientReport(text: string): ClientReport | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  const parsed = reportSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Logs an accepted report as a warn-level notice, `sidereus: client.<step> noted` (D13: any `curl` can post a report,
 * so a client report never becomes an Issue). `logNotice` reads a name only from an `Error` instance, so a report with
 * a name is passed as a fresh `Error` carrying just that name (no message); one without a name passes nothing, so its
 * line has no `name` field (a fresh `Error` would log `name: "Error"`, which the client never sent).
 */
export function logClientReport(report: ClientReport): void {
  const step = `client.${report.step}` as const;
  if (report.name === undefined) {
    logNotice(step);
    return;
  }
  const error = new Error();
  error.name = report.name;
  logNotice(step, error);
}
