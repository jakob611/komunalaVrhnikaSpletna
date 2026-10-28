import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./worker.js";
import { createFileStorage } from "./storage.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.API_PORT || 8787);
const storage = createFileStorage(path.join(root, ".data"));
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const protocol = "http";
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (value != null)
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    // Vite preserves the public Host header so same-origin validation also works through its proxy.
    const init = { method: incoming.method, headers };
    if (incoming.method !== "GET" && incoming.method !== "HEAD") {
      init.body = Readable.toWeb(incoming);
      init.duplex = "half";
    }
    const request = new Request(
      `${protocol}://${incoming.headers.host || `127.0.0.1:${port}`}${incoming.url}`,
      init,
    );
    const response = await handleRequest(request, { LOCAL_STORAGE: storage });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch {
    if (!outgoing.headersSent)
      outgoing.writeHead(500, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
    outgoing.end(JSON.stringify({ error: "Napaka lokalnega strežnika." }));
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`KPV demo API: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
