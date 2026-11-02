import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

const directory = new URL("../migrations/", import.meta.url);
const migrations = readdirSync(directory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
function apply(db) {
  for (const name of migrations)
    db.exec(readFileSync(new URL(name, directory), "utf8"));
}
const objects = (db) =>
  db
    .prepare(
      "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name",
    )
    .all()
    .map((row) => ({
      type: row.type,
      name: row.name,
      sql: row.sql.replace(/\s+/g, " ").trim(),
    }));

test("ordered migrations and fresh schema produce the same database contract", () => {
  const migrated = new DatabaseSync(":memory:"),
    fresh = new DatabaseSync(":memory:");
  try {
    apply(migrated);
    fresh.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
    assert.deepEqual(objects(migrated), objects(fresh));
    apply(migrated);
    assert.deepEqual(objects(migrated), objects(fresh));
  } finally {
    migrated.close();
    fresh.close();
  }
});

test("upgrading an existing portal preserves published content, history, private cases and photo references", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(readFileSync(new URL("0001_baseline.sql", directory), "utf8"));
    db.prepare(
      "INSERT INTO cms_content(section,value,revision,updated_at,source) VALUES('market',?,7,?,'fixture')",
    ).run(
      JSON.stringify({ dates: ["2027-01-02"], closedDates: ["2027-01-09"] }),
      Date.now(),
    );
    db.prepare(
      "INSERT INTO submissions(id,kind,created_at,status,payload) VALUES('KPV-fixture','reports',?,'demo-saved',?)",
    ).run(
      new Date().toISOString(),
      JSON.stringify({
        email: "fixture@example.test",
        description: "Migration fixture",
        photoKey: "fixture-photo.png",
      }),
    );
    const original = db.prepare("SELECT * FROM cms_content").all();
    const history = db.prepare("SELECT * FROM cms_history").all();
    const cases = db.prepare("SELECT * FROM submissions").all();
    apply(db);
    assert.deepEqual(db.prepare("SELECT * FROM cms_content").all(), original);
    assert.deepEqual(db.prepare("SELECT * FROM cms_history").all(), history);
    assert.deepEqual(db.prepare("SELECT * FROM submissions").all(), cases);
    assert.equal(
      db
        .prepare("SELECT COUNT(*) AS n FROM subscriber_management_versions")
        .get().n,
      0,
    );
  } finally {
    db.close();
  }
});
