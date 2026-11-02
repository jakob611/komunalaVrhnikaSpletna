import test from "node:test";
import assert from "node:assert/strict";
import { localD1 } from "./local-d1.mjs";
import { handleCmsEditor, publishSections } from "./cms-editor.js";
import defaults from "../shared/site-defaults.json" with { type: "json" };
import { largeWebsiteFixture } from "./cms-large-test-fixture.mjs";
import { addDays, ljubljanaDate } from "./seed.js";
import { processScheduledPublications } from "./scheduled-publications.js";

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const envFor = () => ({ DB: localD1(":memory:") });
const sections = () => ({
  settings: { ...defaults.settings, siteName: "Posodobljena komunala" },
  market: { dates: ["2027-01-02"], closedDates: [] },
});
const call = (
  env,
  section,
  method = "GET",
  value,
  email = "editor@example.com",
) =>
  handleCmsEditor(
    new Request(`https://portal.example/api/admin/drafts/${section}`, {
      method,
      ...(value
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value),
          }
        : {}),
    }),
    env,
    {
      fail,
      session: { email },
      json: Response.json,
      body: (request) => request.json(),
    },
  );

test("multi-section publication commits content/history together and records the previous release", async () => {
  const env = envFor();
  try {
    const result = await publishSections(
      env,
      sections(),
      { settings: 0, market: 0 },
      "editor@example.com",
      fail,
    );
    assert.deepEqual(result.revisions, { settings: 1, market: 1 });
    const before = await env.DB.prepare(
      "SELECT value FROM cms_publication_values WHERE publication_id=? AND section='market' AND kind='before'",
    )
      .bind(result.publicationId)
      .first();
    const after = await env.DB.prepare(
      "SELECT value FROM cms_publication_values WHERE publication_id=? AND section='settings' AND kind='after'",
    )
      .bind(result.publicationId)
      .first();
    assert.deepEqual(JSON.parse(before.value), defaults.market);
    assert.equal(JSON.parse(after.value).siteName, "Posodobljena komunala");
    assert.equal(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM cms_history").first()).n,
      4,
    );
    await assert.rejects(
      publishSections(
        env,
        {
          settings: { ...defaults.settings, siteName: "Stale" },
          market: { dates: [], closedDates: [] },
        },
        { settings: 1, market: 0 },
        "editor@example.com",
        fail,
      ),
      { status: 409 },
    );
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT value FROM cms_content WHERE section='settings'",
        ).first()
      ).value,
      JSON.stringify(result.sections.settings),
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

test("failed second section trigger rolls back every section, history row and publication record", async () => {
  const env = envFor();
  try {
    await env.DB.prepare(
      "CREATE TRIGGER reject_market BEFORE UPDATE ON cms_content WHEN NEW.section='market' BEGIN SELECT RAISE(ABORT,'forced failure'); END",
    ).run();
    await assert.rejects(
      publishSections(
        env,
        sections(),
        { settings: 0, market: 0 },
        "editor@example.com",
        fail,
      ),
      /forced failure/,
    );
    assert.equal(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM cms_content").first()).n,
      0,
    );
    assert.equal(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM cms_history").first()).n,
      0,
    );
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM cms_publications",
        ).first()
      ).n,
      0,
    );
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM cms_publication_values",
        ).first()
      ).n,
      0,
    );
  } finally {
    env.DB.close();
  }
});

test("durable drafts are isolated per editor, reject stale tabs and allow future tariffs without publishing them", async () => {
  const env = envFor();
  try {
    const tariffs = structuredClone(defaults.tariffs);
    tariffs.municipalities.forEach((item) => {
      item.effectiveFrom = "2099-01-01";
    });
    tariffs.waste.effectiveFrom = "2099-01-01";
    let response = await call(env, "tariffs", "PUT", {
      value: tariffs,
      baseRevisions: { tariffs: 0 },
      revision: 0,
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).revision, 1);
    const recovered = await (await call(env, "tariffs")).json();
    assert.equal(
      recovered.draft.value.municipalities[0].effectiveFrom,
      "2099-01-01",
    );
    assert.equal(
      (
        await (
          await call(env, "tariffs", "GET", undefined, "other@example.com")
        ).json()
      ).draft,
      null,
    );
    await assert.rejects(
      call(env, "tariffs", "PUT", {
        value: tariffs,
        baseRevisions: { tariffs: 0 },
        revision: 0,
      }),
      { status: 409 },
    );
    assert.equal(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM cms_content").first()).n,
      0,
    );
    await assert.rejects(
      publishSections(
        env,
        { tariffs },
        { tariffs: 0 },
        "editor@example.com",
        fail,
      ),
      /prihodnji/,
    );
    await assert.rejects(
      call(env, "website", "PUT", {
        value: {},
        baseRevisions: { copy: 0, images: 0, links: 0, layout: 0, settings: 0 },
        revision: 0,
      }),
      { status: 400 },
    );
    assert.equal(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM cms_drafts").first()).n,
      1,
    );
  } finally {
    env.DB.close();
  }
});

test("a scheduled publication identity is replayable once and cannot carry different content", async () => {
  const env = envFor();
  try {
    const first = await publishSections(
      env,
      sections(),
      { settings: 0, market: 0 },
      "editor@example.com",
      fail,
      "schedule-fixture",
    );
    const retry = await publishSections(
      env,
      sections(),
      { settings: 0, market: 0 },
      "editor@example.com",
      fail,
      "schedule-fixture",
    );
    assert.equal(retry.replayed, true);
    assert.equal(first.publicationId, retry.publicationId);
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM cms_publications",
        ).first()
      ).n,
      1,
    );
    await assert.rejects(
      publishSections(
        env,
        { settings: defaults.settings },
        { settings: 1 },
        "editor@example.com",
        fail,
        "schedule-fixture",
      ),
      { status: 409 },
    );
  } finally {
    env.DB.close();
  }
});

test("website snapshots above 2 MB use per-section rows for publication, private drafts and immutable schedules", async () => {
  const env = envFor(),
    value = largeWebsiteFixture();
  const revisions = Object.fromEntries(
    Object.keys(value).map((key) => [key, 0]),
  );
  assert.ok(Buffer.byteLength(JSON.stringify(value)) > 2_000_000);
  try {
    const saved = await call(env, "website", "PUT", {
      value,
      baseRevisions: revisions,
      revision: 0,
    });
    assert.equal(saved.status, 200);
    const recovered = await (await call(env, "website")).json();
    assert.deepEqual(recovered.draft.value, value);
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT value FROM cms_drafts WHERE section='website'",
        ).first()
      ).value,
      "{}",
    );
    const draftSizes = await env.DB.prepare(
      "SELECT length(CAST(value AS BLOB)) AS bytes FROM cms_draft_values",
    ).all();
    assert.equal(draftSizes.results.length, 5);
    assert.ok(draftSizes.results.every((row) => row.bytes <= 1024 * 1024));
    const publication = await publishSections(
      env,
      value,
      revisions,
      "editor@example.com",
      fail,
      "large-release",
    );
    const again = await publishSections(
      env,
      value,
      publication.revisions,
      "editor@example.com",
      fail,
      "large-release-2",
    );
    assert.equal(Object.keys(again.revisions).length, 5);
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM cms_publication_values WHERE publication_id='large-release-2'",
        ).first()
      ).n,
      10,
    );
    const sizes = await env.DB.prepare(
      "SELECT length(CAST(value AS BLOB)) AS bytes FROM cms_publication_values",
    ).all();
    assert.ok(sizes.results.every((row) => row.bytes <= 1024 * 1024));
    const scheduled = await handleCmsEditor(
      new Request("https://portal.example/api/admin/schedules", {
        method: "POST",
        body: JSON.stringify({
          section: "website",
          value,
          baseRevisions: again.revisions,
          publishOn: addDays(ljubljanaDate(), 1),
        }),
      }),
      env,
      {
        fail,
        session: { email: "editor@example.com" },
        json: (data, status = 200) => Response.json(data, { status }),
        body: (request) => request.json(),
      },
    );
    const scheduleId = (await scheduled.json()).id;
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT value FROM cms_scheduled_publications WHERE id=?",
        )
          .bind(scheduleId)
          .first()
      ).value,
      "{}",
    );
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM cms_scheduled_values WHERE schedule_id=?",
        )
          .bind(scheduleId)
          .first()
      ).n,
      5,
    );
    await env.DB.prepare(
      "INSERT INTO admin_users(email,role,status,version,created_at,updated_at) VALUES('editor@example.com','owner','active',1,0,0)",
    ).run();
    const activated = await processScheduledPublications(
      env,
      Date.parse(addDays(ljubljanaDate(), 1) + "T12:00:00Z"),
    );
    assert.equal(activated.published, 1);
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT status FROM cms_scheduled_publications WHERE id=?",
        )
          .bind(scheduleId)
          .first()
      ).status,
      "published",
    );
    const listing = await handleCmsEditor(
      new Request("https://portal.example/api/admin/publications"),
      env,
      { fail, session: { email: "editor@example.com" }, json: Response.json },
    );
    const listed = await listing.json();
    assert.equal(listed.items.length, 3);
    assert.ok(
      JSON.stringify(listed).length < 2000,
      "publication list returns metadata rather than all snapshots",
    );
  } finally {
    env.DB.close();
  }
});

test("stale draft CAS cannot replace normalized child rows or delete a newer draft", async () => {
  const env = envFor(),
    original = largeWebsiteFixture();
  const revisions = Object.fromEntries(
    Object.keys(original).map((key) => [key, 0]),
  );
  try {
    await call(env, "website", "PUT", {
      value: original,
      baseRevisions: revisions,
      revision: 0,
    });
    const changed = structuredClone(original);
    changed.settings.siteName = "Newer private draft";
    await call(env, "website", "PUT", {
      value: changed,
      baseRevisions: revisions,
      revision: 1,
    });
    const token = (
      await env.DB.prepare(
        "SELECT write_token FROM cms_drafts WHERE section='website'",
      ).first()
    ).write_token;
    const stale = structuredClone(original);
    stale.copy[0].value = "Stale overwrite";
    await assert.rejects(
      call(env, "website", "PUT", {
        value: stale,
        baseRevisions: revisions,
        revision: 1,
      }),
      { status: 409 },
    );
    await assert.rejects(call(env, "website", "DELETE", { revision: 1 }), {
      status: 409,
    });
    const recovered = (await (await call(env, "website")).json()).draft;
    assert.equal(recovered.revision, 2);
    assert.deepEqual(recovered.value, changed);
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT write_token FROM cms_drafts WHERE section='website'",
        ).first()
      ).write_token,
      token,
    );
    await env.DB.prepare(
      "CREATE TRIGGER reject_draft_child BEFORE INSERT ON cms_draft_values WHEN NEW.section='layout' BEGIN SELECT RAISE(ABORT,'forced child failure'); END",
    ).run();
    await assert.rejects(
      call(env, "website", "PUT", {
        value: original,
        baseRevisions: revisions,
        revision: 2,
      }),
      /forced child failure/,
    );
    assert.deepEqual(
      (await (await call(env, "website")).json()).draft,
      recovered,
      "failed child replacement rolls back parent and every child",
    );
    await call(env, "website", "DELETE", { revision: 2 });
    assert.equal((await (await call(env, "website")).json()).draft, null);
    assert.equal(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM cms_draft_values",
        ).first()
      ).n,
      0,
    );
  } finally {
    env.DB.close();
  }
});

test("schedule filtering occurs before its limit and keeps an older active section visible", async () => {
  const env = envFor();
  try {
    await env.DB.prepare(
      "INSERT INTO cms_scheduled_publications(id,section,value,base_revisions,publish_on,created_at,created_by,status,updated_at,publication_id) VALUES('older','tariffs','{}','{}','2099-01-01',0,'editor@example.com','pending',0,'publication-older')",
    ).run();
    for (let index = 0; index < 60; index++)
      await env.DB.prepare(
        "INSERT INTO cms_scheduled_publications(id,section,value,base_revisions,publish_on,created_at,created_by,status,updated_at,publication_id) VALUES(?,'notices','[]','{}','2099-01-01',?,'editor@example.com','published',0,?)",
      )
        .bind(`new-${index}`, index + 1, `publication-${index}`)
        .run();
    const response = await handleCmsEditor(
      new Request("https://portal.example/api/admin/schedules?section=tariffs"),
      env,
      { fail, json: Response.json },
    );
    assert.deepEqual(
      (await response.json()).items.map((item) => item.id),
      ["older"],
    );
    await assert.rejects(
      handleCmsEditor(
        new Request(
          "https://portal.example/api/admin/schedules?section=invalid",
        ),
        env,
        { fail, json: Response.json },
      ),
      { status: 400 },
    );
  } finally {
    env.DB.close();
  }
});
