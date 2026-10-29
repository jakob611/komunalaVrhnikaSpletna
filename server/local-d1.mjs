import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// D1-compatible adapter for the loopback-only development server. Each batch
// executes synchronously in one SQLite transaction, without yielding between writes.
export function localD1(filename) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const prepare = (query, args = []) => {
    const result = (rows) => ({
      success: true,
      results: rows,
      meta: { changes: sqlite.prepare("SELECT changes() AS n").get().n },
    });
    return {
      bind: (...values) => prepare(query, values),
      async first(column) {
        const row = sqlite.prepare(query).get(...args) || null;
        return column && row ? row[column] : row;
      },
      async all() {
        return result(sqlite.prepare(query).all(...args));
      },
      async run() {
        return result(sqlite.prepare(query).all(...args));
      },
      execute() {
        return result(sqlite.prepare(query).all(...args));
      },
    };
  };
  return {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    close: () => sqlite.close(),
  };
}
