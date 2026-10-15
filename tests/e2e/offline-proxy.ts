import { createServer, request as httpRequest, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";

/*
 * The reverse proxy the offline specs go offline through (`offline.spec.ts`, `finder-offline.spec.ts`). Playwright's
 * `context.setOffline(true)` does not reliably cut the service worker's own fetches, so a spec runs its context on the
 * proxy's origin and makes the server unreachable by stopping the proxy, which the worker sees as a refused
 * connection. The proxy listens on an ephemeral port, so two specs never collide. `delayNext` holds back one matching
 * response, which is how a spec makes a slow network that the service worker's own fetch sees (a slow redirect landing).
 */

/** A pass-through proxy to `upstream` (method, path, headers, cookies, body, status and redirects untouched). */
export class Proxy {
  private server: Server | null = null;
  private readonly sockets = new Set<Socket>();
  private readonly delays: { match: (request: IncomingMessage) => boolean; ms: number }[] = [];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  port = 0;
  /** How many responses `delayNext` has held back so far, so a spec can prove its delay applied. */
  delayed = 0;

  constructor(private readonly upstream: URL) {}

  get origin(): string {
    return `http://localhost:${String(this.port)}`;
  }

  /**
   * Holds back the response to the next request `match` accepts by `ms` (the upstream is asked at once, so the server
   * has done its work; only the answer is late), once. Later matching requests pass straight through.
   */
  delayNext(match: (request: IncomingMessage) => boolean, ms: number): void {
    this.delays.push({ match, ms });
  }

  async start(): Promise<void> {
    const server = createServer((req, res) => {
      const forward = httpRequest(
        {
          hostname: this.upstream.hostname,
          port: this.upstream.port,
          method: req.method,
          path: req.url,
          // The Host header stays the proxy's, so the app's redirects and origin checks see the browser's origin.
          headers: req.headers,
          agent: false,
        },
        (upstream) => {
          const answer = () => {
            res.writeHead(upstream.statusCode ?? 502, upstream.statusMessage, upstream.rawHeaders);
            upstream.pipe(res);
          };
          const delay = this.delays.findIndex((entry) => entry.match(req));
          if (delay === -1) {
            answer();
            return;
          }
          const [{ ms }] = this.delays.splice(delay, 1);
          this.delayed += 1;
          upstream.pause();
          const timer = setTimeout(() => {
            this.timers.delete(timer);
            answer();
          }, ms);
          this.timers.add(timer);
        },
      );
      forward.on("error", () => res.destroy());
      req.pipe(forward);
    });
    server.on("connection", (socket) => {
      this.sockets.add(socket);
      socket.on("close", () => this.sockets.delete(socket));
    });
    await new Promise<void>((resolve, reject) => {
      // Restarting on the same port can fail (still in use): fail the test here, not on a later navigation.
      server.once("error", reject);
      server.listen(this.port, "localhost", resolve);
    });
    this.port = (server.address() as AddressInfo).port;
    this.server = server;
  }

  /** Unreachable from now on: no listener, and every open connection dropped. */
  async stop(): Promise<void> {
    const server = this.server;
    if (!server) return;
    this.server = null;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    const closed = new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    for (const socket of this.sockets) socket.destroy();
    await closed;
  }
}
