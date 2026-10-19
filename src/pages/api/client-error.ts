import type { APIRoute } from "astro";
import {
  logClientReport,
  MAX_REPORT_BYTES,
  parseClientReport,
  readBoundedBody,
} from "@/lib/observability/client-report";
import { allowClientError } from "@/lib/observability/rate-limit";

/*
 * Collects a failure the browser could not log itself (error-visibility, Phase 7): the service worker and the React
 * islands post `{ step, name? }` here (Phases 8 and 9), and an accepted report becomes one warn-level
 * `sidereus: client.<step> noted` line. The one deliberate exception to "API routes redirect with `?error=`": a beacon
 * has no page to go back to, so it answers with a status and an empty body.
 *
 * The endpoint is public and its callers untrusted (any `curl` sets `Origin` and every field), so a report is only a
 * notice, never a failure (D13), and every check that costs nothing comes before the one that spends the shared
 * budget: same origin (403), body of at most 512 bytes (413, enforced while reading; a body the client broke off is
 * 400), `application/json` or `text/plain` (415), the strict schema (400), then the rate limit (429). So garbage and
 * refused requests never use up the 30 per minute a real report needs; only a well-formed one does. For `text/plain`
 * the first gate is Astro's `checkOrigin`, which refuses a cross-site form-like POST before this route runs; a beacon
 * sends its page's `Origin`, so it passes. The route reads no cookie, no `locals` field and never the database; the
 * middleware lets the path through before it resolves the session (`isClientErrorPath`).
 */

const NO_STORE = { "Cache-Control": "no-store" };

const refuse = (status: number, headers?: Record<string, string>) =>
  new Response(null, { status, headers: { ...NO_STORE, ...headers } });

/** A request from this site's own pages or worker: `Sec-Fetch-Site: same-origin`, else an `Origin` equal to ours. */
function isSameOrigin(request: Request, origin: string): boolean {
  return request.headers.get("sec-fetch-site") === "same-origin" || request.headers.get("origin") === origin;
}

export const POST: APIRoute = async ({ request, url }) => {
  if (!isSameOrigin(request, url.origin)) {
    return refuse(403);
  }
  const body = await readBoundedBody(request, MAX_REPORT_BYTES);
  if ("refused" in body) {
    return refuse(body.refused === "too-large" ? 413 : 400);
  }
  const type = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json" && type !== "text/plain") {
    return refuse(415);
  }
  const report = parseClientReport(body.text);
  if (report === undefined) {
    return refuse(400);
  }
  if (!(await allowClientError())) {
    return refuse(429);
  }
  logClientReport(report);
  return new Response(null, { status: 204, headers: NO_STORE });
};

/** Any other method is refused here, so a probing `GET` gets this answer and not a page. */
export const ALL: APIRoute = () => refuse(405, { Allow: "POST" });
