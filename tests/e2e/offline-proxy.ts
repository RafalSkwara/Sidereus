import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";

/*
 * The reverse proxy the offline specs go offline through (`offline.spec.ts`, `finder-offline.spec.ts`). Playwright's
 * `context.setOffline(true)` does not reliably cut the service worker's own fetches, so a spec runs its context on the
 * proxy's origin and makes the server unreachable by stopping the proxy, which the worker sees as a refused
 * connection. The proxy listens on an ephemeral port, so two specs never collide.
 */

/** A pass-through proxy to `upstream` (method, path, headers, cookies, body, status and redirects untouched). */
export class Proxy {
  private server: Server | null = null;
  private readonly sockets = new Set<Socket>();
  port = 0;

  constructor(private readonly upstream: URL) {}

  get origin(): string {
    return `http://localhost:${String(this.port)}`;
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
          res.writeHead(upstream.statusCode ?? 502, upstream.statusMessage, upstream.rawHeaders);
          upstream.pipe(res);
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
    const closed = new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    for (const socket of this.sockets) socket.destroy();
    await closed;
  }
}
