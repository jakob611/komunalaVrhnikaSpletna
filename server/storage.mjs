import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

// A single-process queue makes each read-modify-write atomic in the local demo.
export function createFileStorage(directory) {
  const recordsPath = path.join(directory, "records.json");
  let pending = Promise.resolve();
  async function read() {
    try {
      return JSON.parse(await readFile(recordsPath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
  return {
    async save(record) {
      const operation = pending.then(async () => {
        await mkdir(directory, { recursive: true });
        const rows = await read();
        rows.push(record);
        const temporary = `${recordsPath}.${crypto.randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify(rows, null, 2), {
          mode: 0o600,
        });
        await rename(temporary, recordsPath);
      });
      pending = operation.catch(() => {});
      await operation;
    },
    async putPhoto(key, bytes) {
      await mkdir(path.join(directory, "photos"), { recursive: true });
      await writeFile(
        path.join(directory, "photos", path.basename(key)),
        new Uint8Array(bytes),
        { mode: 0o600 },
      );
    },
    async deletePhoto(key) {
      try {
        await unlink(path.join(directory, "photos", path.basename(key)));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    },
  };
}
