import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./worker.js";
import { createFileStorage } from "./storage.mjs";
import { localD1 } from "./local-d1.mjs";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.API_PORT || 8787);
const dataDirectory = process.env.KPV_DATA_DIR ? path.resolve(process.env.KPV_DATA_DIR) : path.join(root, ".data");
await mkdir(dataDirectory, { recursive: true });
const storage = createFileStorage(dataDirectory);
const cmsDB = localD1(path.join(dataDirectory, "cms.sqlite"));
const photoDirectory = path.join(dataDirectory, "cms-media");
const photoPath = (key) =>
  path.join(
    key.startsWith("cms/")
      ? photoDirectory
      : path.join(dataDirectory, "photos"),
    path.basename(key),
  );
const localStorage = {
  ...storage,
  async save(record) {
    const table =
      record.kind === "contact" ? "contact_submissions" : "submissions";
    await cmsDB
      .prepare(
        `INSERT INTO ${table}(id,kind,created_at,status,payload) VALUES(?,?,?,?,?)`,
      )
      .bind(
        record.id,
        record.kind,
        record.createdAt,
        record.status,
        JSON.stringify(record.payload),
      )
      .run();
  },
};
const environment = {
  LOCAL_STORAGE: localStorage,
  DB: cmsDB,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  ADMIN_OWNER_EMAIL: process.env.ADMIN_OWNER_EMAIL || "tomincjakob@gmail.com",
  EMAIL_FROM: "KPV razvoj <razvoj@kpv.jakobtominc.com>",
  async ADMIN_AUTH_SEND(message) {
    // Development-only private mailbox: no codes in an API response or console log.
    await writeFile(
      path.join(dataDirectory, "admin-auth-mail.json"),
      JSON.stringify(
        { ...message, createdAt: new Date().toISOString() },
        null,
        2,
      ),
    );
  },
  PHOTOS: {
    async put(key, bytes) {
      await mkdir(photoDirectory, { recursive: true });
      await writeFile(photoPath(key), new Uint8Array(bytes));
    },
    async get(key) {
      try {
        const bytes = await readFile(photoPath(key));
        return {
          body: bytes,
          arrayBuffer: async () =>
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ),
        };
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      try {
        await unlink(photoPath(key));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    },
  },
};
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
    const response = await handleRequest(request, environment);
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
