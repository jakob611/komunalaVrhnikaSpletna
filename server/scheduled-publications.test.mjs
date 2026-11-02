import test from "node:test";
import assert from "node:assert/strict";
import defaults from "../shared/site-defaults.json" with { type: "json" };
import { localD1 } from "./local-d1.mjs";
import { processScheduledPublications } from "./scheduled-publications.js";
import { publishSections } from "./cms-editor.js";
import { validateDraftSection } from "../shared/cms-validation.js";
import { addDays, ljubljanaDate } from "./seed.js";

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const email = "editor@example.test";
async function environment() {
  const env = { DB: localD1(":memory:") };
  await env.DB.prepare(
    "INSERT INTO admin_users(email,role,status,version,created_at,updated_at) VALUES(?,'editor','active',1,0,0)",
  )
    .bind(email)
    .run();
  await env.DB.prepare(
    "INSERT INTO admin_user_permissions(email,access_scope) VALUES(?,'content')",
  )
    .bind(email)
    .run();
  return env;
}
async function schedule(
  env,
  {
    section = "settings",
    value = { ...defaults.settings, siteName: "Načrtovana vsebina" },
    revisions = { settings: 0 },
    publishOn = ljubljanaDate(),
    status = "pending",
    lease = 0,
  } = {},
) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO cms_scheduled_publications(id,section,value,base_revisions,publish_on,created_at,created_by,status,lease_until,updated_at,publication_id) VALUES(?,?,?,?,?,0,?,?,?,0,?)",
  )
    .bind(
      id,
      section,
      section === "website" ? "{}" : JSON.stringify(value),
      JSON.stringify(revisions),
      publishOn,
      email,
      status,
      lease,
      `scheduled-${id}`,
    )
    .run();
  if (section === "website")
    await env.DB.batch(
      Object.entries(value).map(([key, item]) =>
        env.DB.prepare(
          "INSERT INTO cms_scheduled_values(schedule_id,section,value) VALUES(?,?,?)",
        ).bind(id, key, JSON.stringify(item)),
      ),
    );
  return { id, publicationId: `scheduled-${id}`, value, revisions, section };
}
const row = (env, id) =>
  env.DB.prepare("SELECT * FROM cms_scheduled_publications WHERE id=?")
    .bind(id)
    .first();

test("date-only activation follows Ljubljana midnight in winter and summer and concurrent crons publish once", async () => {
  for (const [before, midnight, day] of [
    ["2026-10-31T22:59:59Z", "2026-10-31T23:00:00Z", "2026-11-01"],
    ["2026-06-30T21:59:59Z", "2026-06-30T22:00:00Z", "2026-07-01"],
  ]) {
    const env = await environment();
    try {
      const item = await schedule(env, { publishOn: day });
      assert.equal(
        (await processScheduledPublications(env, Date.parse(before))).published,
        0,
      );
      assert.equal((await row(env, item.id)).status, "pending");
      await Promise.all([
        processScheduledPublications(env, Date.parse(midnight)),
        processScheduledPublications(env, Date.parse(midnight)),
      ]);
      assert.equal((await row(env, item.id)).status, "published");
      assert.equal(
        (
          await env.DB.prepare(
            "SELECT revision FROM cms_content WHERE section='settings'",
          ).first()
        ).revision,
        1,
      );
      assert.equal(
        (
          await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM cms_publications",
          ).first()
        ).n,
        1,
      );
    } finally {
      env.DB.close();
    }
  }
});

test("a newer public revision fails the entire scheduled website snapshot without overwriting other content", async () => {
  const env = await environment();
  try {
    const keys = ["copy", "images", "links", "layout", "settings"];
    const value = Object.fromEntries(
      keys.map((key) => [key, structuredClone(defaults[key])]),
    );
    value.settings.siteName = "Scheduled website";
    const item = await schedule(env, {
      section: "website",
      value,
      revisions: Object.fromEntries(keys.map((key) => [key, 0])),
    });
    await publishSections(
      env,
      { settings: { ...defaults.settings, siteName: "Newer public edit" } },
      { settings: 0 },
      email,
      fail,
    );
    await processScheduledPublications(env);
    const state = await row(env, item.id);
    assert.equal(state.status, "failed");
    assert.match(state.error, /spremenil drug urednik/);
    assert.equal(
      JSON.parse(
        (
          await env.DB.prepare(
            "SELECT value FROM cms_content WHERE section='settings'",
          ).first()
        ).value,
      ).siteName,
      "Newer public edit",
    );
    for (const key of keys.filter((key) => key !== "settings"))
      assert.equal(
        (
          await env.DB.prepare(
            "SELECT revision FROM cms_content WHERE section=?",
          )
            .bind(key)
            .first()
        ).revision,
        0,
      );
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM cms_publications",
        ).first()
      ).n,
      1,
    );
  } finally {
    env.DB.close();
  }
});

test("expired leases reconcile an already committed publication instead of replaying it over a newer edit", async () => {
  const env = await environment();
  const now = Date.now();
  try {
    const item = await schedule(env, { status: "running", lease: now - 1 });
    await publishSections(
      env,
      { settings: item.value },
      item.revisions,
      email,
      fail,
      item.publicationId,
    );
    await publishSections(
      env,
      { settings: { ...defaults.settings, siteName: "Later published edit" } },
      { settings: 1 },
      email,
      fail,
    );
    // An acknowledgement remains truthful even if the author was subsequently revoked.
    await env.DB.prepare(
      "UPDATE admin_users SET status='revoked' WHERE email=?",
    )
      .bind(email)
      .run();
    await processScheduledPublications(env, now);
    assert.equal((await row(env, item.id)).status, "published");
    const current = await env.DB.prepare(
      "SELECT value,revision FROM cms_content WHERE section='settings'",
    ).first();
    assert.equal(JSON.parse(current.value).siteName, "Later published edit");
    assert.equal(current.revision, 2);
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM cms_publications",
        ).first()
      ).n,
      2,
    );
  } finally {
    env.DB.close();
  }
});

test("revoked authors and operations-only staff cannot activate queued content", async () => {
  for (const state of ["revoked", "operations"]) {
    const env = await environment();
    try {
      const item = await schedule(env);
      if (state === "revoked")
        await env.DB.prepare(
          "UPDATE admin_users SET status='revoked' WHERE email=?",
        )
          .bind(email)
          .run();
      else
        await env.DB.prepare(
          "UPDATE admin_user_permissions SET access_scope='operations' WHERE email=?",
        )
          .bind(email)
          .run();
      await processScheduledPublications(env);
      assert.equal((await row(env, item.id)).status, "failed");
      assert.match((await row(env, item.id)).error, /dostopa/);
      assert.equal(
        (
          await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM cms_publications",
          ).first()
        ).n,
        0,
      );
    } finally {
      env.DB.close();
    }
  }
});

test("transient failures retain a recoverable lease and later activate the same immutable snapshot once", async () => {
  const env = await environment();
  const now = Date.now();
  try {
    const item = await schedule(env);
    const originalBatch = env.DB.batch.bind(env.DB);
    let broken = true;
    env.DB.batch = async (statements) => {
      if (broken) throw new Error("injected connection failure");
      return originalBatch(statements);
    };
    const attempted = await processScheduledPublications(env, now);
    assert.equal(attempted.retrying, 1);
    assert.equal((await row(env, item.id)).status, "running");
    broken = false;
    assert.equal(
      (await processScheduledPublications(env, now + 60000)).published,
      0,
    );
    assert.equal(
      (await processScheduledPublications(env, now + 6 * 60000)).published,
      1,
    );
    assert.equal((await row(env, item.id)).status, "published");
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM cms_publications",
        ).first()
      ).n,
      1,
    );
  } finally {
    env.DB.close();
  }
});

test("future tariffs can remain drafts but activation still validates effective dates", async () => {
  const env = await environment();
  try {
    const tariffs = structuredClone(defaults.tariffs);
    const future = addDays(ljubljanaDate(), 10);
    tariffs.municipalities.forEach((municipality) => {
      municipality.effectiveFrom = future;
    });
    tariffs.waste.effectiveFrom = future;
    assert.doesNotThrow(() => validateDraftSection("tariffs", tariffs));
    const item = await schedule(env, {
      section: "tariffs",
      value: tariffs,
      revisions: { tariffs: 0 },
    });
    await processScheduledPublications(env);
    assert.equal((await row(env, item.id)).status, "failed");
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM cms_publications",
        ).first()
      ).n,
      0,
    );
  } finally {
    env.DB.close();
  }
});
