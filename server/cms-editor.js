import defaults from "../shared/site-defaults.json" with { type: "json" };
import {
  CMS_SECTIONS,
  validateSection,
  validateDraftSection,
} from "../shared/cms-validation.js";
import { tariffDate } from "../shared/utility-pricing.js";

const websiteSections = ["copy", "images", "links", "layout", "settings"];
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const validRevision = (value) => Number.isSafeInteger(value) && value >= 0;

function websiteValue(rows, fail) {
  const values = Object.fromEntries(
    rows.map((row) => [row.section, JSON.parse(row.value)]),
  );
  if (
    rows.length !== websiteSections.length ||
    websiteSections.some((key) => !Object.hasOwn(values, key))
  )
    fail(
      503,
      "Shranjeni posnetek spletne strani ni popoln. Ponovno odprite osnutek.",
    );
  return Object.fromEntries(websiteSections.map((key) => [key, values[key]]));
}

export async function scheduledValues(env, schedule, fail) {
  if (schedule.section !== "website")
    return { [schedule.section]: JSON.parse(schedule.value) };
  const { results } = await env.DB.prepare(
    "SELECT section,value FROM cms_scheduled_values WHERE schedule_id=? ORDER BY section",
  )
    .bind(schedule.id)
    .all();
  return websiteValue(results, fail);
}

function draftValue(section, value, fail) {
  if (section !== "website") return validateDraftSection(section, value);
  if (
    !object(value) ||
    Object.keys(value).length !== websiteSections.length ||
    websiteSections.some((key) => !Object.hasOwn(value, key))
  )
    fail(
      400,
      "Osnutek spletne strani mora vsebovati besedila, slike, povezave, razporeditev in nastavitve.",
    );
  return Object.fromEntries(
    websiteSections.map((key) => [key, validateDraftSection(key, value[key])]),
  );
}

/** All changed sections share a single guarded UPDATE and one D1 transaction. */
export async function publishSections(
  env,
  values,
  revisions,
  actor,
  fail,
  publicationId,
) {
  if (!env.DB) fail(503, "Vsebinska shramba ni dosegljiva.");
  if (!object(values) || !object(revisions)) fail(400, "Objava ni veljavna.");
  const keys = Object.keys(values);
  if (
    !keys.length ||
    keys.length > CMS_SECTIONS.length ||
    keys.some((key) => !CMS_SECTIONS.includes(key))
  )
    fail(400, "Izberite veljavna področja za objavo.");
  if (keys.some((key) => !validRevision(revisions[key])))
    fail(400, "Različice za objavo niso veljavne.");
  const clean = Object.fromEntries(
    keys.map((key) => [key, validateSection(key, values[key])]),
  );
  if (publicationId) {
    const previous = await env.DB.prepare(
      "SELECT actor,sections FROM cms_publications WHERE id=?",
    )
      .bind(publicationId)
      .first();
    if (previous) {
      const { results } = await env.DB.prepare(
        "SELECT section,value FROM cms_publication_values WHERE publication_id=? AND kind='after'",
      )
        .bind(publicationId)
        .all();
      const after = Object.fromEntries(
        results.map((row) => [row.section, JSON.parse(row.value)]),
      );
      if (
        previous.actor !== actor ||
        results.length !== keys.length ||
        keys.some(
          (key) =>
            !Object.hasOwn(after, key) ||
            JSON.stringify(after[key]) !== JSON.stringify(clean[key]),
        )
      )
        fail(409, "Identiteta objave je že uporabljena.");
      return { publicationId, sections: clean, revisions: {}, replayed: true };
    }
  }
  const now = Date.now(),
    id = publicationId || crypto.randomUUID(),
    source = `publication:${id}:${actor}`;
  const guard = keys.map(() => "(section = ? AND revision = ?)").join(" OR ");
  const expected = keys.flatMap((key) => [key, revisions[key]]);
  const placeholders = keys.map(() => "?").join(",");
  const queries = keys.map((key) =>
    env.DB.prepare(
      "INSERT INTO cms_content(section,value,revision,updated_at,source) VALUES(?,?,0,?,'default') ON CONFLICT(section) DO NOTHING",
    ).bind(key, JSON.stringify(defaults[key]), now),
  );
  queries.push(
    env.DB.prepare(
      `INSERT INTO cms_publications(id,created_at,actor,sections) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM cms_content WHERE ${guard}) = ?`,
    ).bind(id, now, actor, JSON.stringify(keys), ...expected, keys.length),
  );
  for (const key of keys) {
    queries.push(
      env.DB.prepare(
        "INSERT INTO cms_publication_values(publication_id,section,kind,value) SELECT ?,section,'before',value FROM cms_content WHERE section=? AND EXISTS(SELECT 1 FROM cms_publications WHERE id=?)",
      ).bind(id, key, id),
    );
    queries.push(
      env.DB.prepare(
        "INSERT INTO cms_publication_values(publication_id,section,kind,value) SELECT ?,?,'after',? WHERE EXISTS(SELECT 1 FROM cms_publications WHERE id=?)",
      ).bind(id, key, JSON.stringify(clean[key]), id),
    );
  }
  queries.push(
    env.DB.prepare(
      `UPDATE cms_content SET value = CASE section ${keys.map(() => "WHEN ? THEN ?").join(" ")} END, revision = revision + 1, updated_at = ?, source = ? WHERE section IN (${placeholders}) AND (SELECT COUNT(*) FROM cms_content WHERE ${guard}) = ? RETURNING section,value,revision`,
    ).bind(
      ...keys.flatMap((key) => [key, JSON.stringify(clean[key])]),
      now,
      source,
      ...keys,
      ...expected,
      keys.length,
    ),
  );
  const results = await env.DB.batch(queries);
  const rows = results.at(-1).results || [];
  if (rows.length !== keys.length)
    fail(
      409,
      "Objava ni spremenila nobenega področja: vsebino je medtem spremenil drug urednik. Osvežite objavljene podatke in primerjajte osnutek.",
    );
  return {
    publicationId: id,
    sections: Object.fromEntries(
      rows.map((row) => [row.section, JSON.parse(row.value)]),
    ),
    revisions: Object.fromEntries(
      rows.map((row) => [row.section, row.revision]),
    ),
  };
}

export async function handleCmsEditor(
  request,
  env,
  { json, body, fail, session },
) {
  const url = new URL(request.url),
    path = url.pathname;
  if (path === "/api/admin/schedules") {
    if (request.method === "GET") {
      const section = url.searchParams.get("section") || "";
      if (section && section !== "website" && !CMS_SECTIONS.includes(section))
        fail(400, "Področje objave ni veljavno.");
      const { results } = await env.DB.prepare(
        "SELECT id,section,publish_on,status,created_at,created_by,error FROM cms_scheduled_publications WHERE (?='' OR section=?) ORDER BY CASE WHEN status IN ('pending','running','failed') THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 50",
      )
        .bind(section, section)
        .all();
      return json({
        items: results.map((row) => ({
          id: row.id,
          section: row.section,
          publishOn: row.publish_on,
          status: row.status,
          createdAt: row.created_at,
          createdBy: row.created_by,
          error: row.error,
        })),
      });
    }
    if (request.method !== "POST") fail(405, "Metoda ni dovoljena.");
    const data = await body(request, 6 * 1024 * 1024);
    const section = data.section;
    if (section !== "website" && !CMS_SECTIONS.includes(section))
      fail(400, "Področje objave ni veljavno.");
    if (
      typeof data.publishOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.publishOn) ||
      !Number.isFinite(Date.parse(data.publishOn + "T12:00:00Z")) ||
      new Date(data.publishOn + "T12:00:00Z").toISOString().slice(0, 10) !==
        data.publishOn ||
      data.publishOn <= tariffDate()
    )
      fail(400, "Izberite prihodnji veljaven datum objave po slovenskem času.");
    const value = draftValue(section, data.value, fail);
    const keys = section === "website" ? websiteSections : [section];
    if (
      !object(data.baseRevisions) ||
      keys.some((key) => !validRevision(data.baseRevisions[key])) ||
      Object.keys(data.baseRevisions).some((key) => !keys.includes(key))
    )
      fail(400, "Osnovne različice objave niso veljavne.");
    if (
      section === "tariffs" &&
      (value.municipalities.some(
        (item) => item.effectiveFrom > data.publishOn,
      ) ||
        value.waste.effectiveFrom > data.publishOn)
    )
      fail(
        400,
        "Objava ne sme biti načrtovana pred začetkom veljavnosti cenika.",
      );
    const existing = await env.DB.prepare(
      "SELECT id FROM cms_scheduled_publications WHERE section=? AND status IN ('pending','running')",
    )
      .bind(section)
      .first();
    if (existing)
      fail(
        409,
        "To področje že ima načrtovano objavo. Pred novo objavo prekličite prejšnji načrt.",
      );
    const id = crypto.randomUUID(),
      now = Date.now();
    try {
      const queries = [
        env.DB.prepare(
          "INSERT INTO cms_scheduled_publications(id,section,value,base_revisions,publish_on,created_at,created_by,status,updated_at,publication_id) VALUES(?,?,?,?,?,?,?,'pending',?,?)",
        ).bind(
          id,
          section,
          section === "website" ? "{}" : JSON.stringify(value),
          JSON.stringify(data.baseRevisions),
          data.publishOn,
          now,
          session.email,
          now,
          `scheduled-${id}`,
        ),
      ];
      if (section === "website")
        for (const key of websiteSections)
          queries.push(
            env.DB.prepare(
              "INSERT INTO cms_scheduled_values(schedule_id,section,value) VALUES(?,?,?)",
            ).bind(id, key, JSON.stringify(value[key])),
          );
      await env.DB.batch(queries);
    } catch (cause) {
      if (String(cause).includes("UNIQUE"))
        fail(409, "To področje že ima načrtovano objavo. Osvežite seznam.");
      throw cause;
    }
    return json({ id, status: "pending", publishOn: data.publishOn }, 201);
  }
  const schedule = path.match(/^\/api\/admin\/schedules\/([a-f0-9-]{36})$/);
  if (schedule) {
    if (request.method !== "DELETE") fail(405, "Metoda ni dovoljena.");
    const row = await env.DB.prepare(
      "SELECT created_by,status FROM cms_scheduled_publications WHERE id=?",
    )
      .bind(schedule[1])
      .first();
    if (!row) fail(404, "Načrtovana objava ne obstaja.");
    if (session.role !== "owner" && row.created_by !== session.email)
      fail(403, "Prekličete lahko samo svojo načrtovano objavo.");
    const cancelled = await env.DB.prepare(
      "UPDATE cms_scheduled_publications SET status='cancelled',updated_at=? WHERE id=? AND status='pending' RETURNING id",
    )
      .bind(Date.now(), schedule[1])
      .first();
    if (!cancelled)
      fail(
        409,
        "Objava se že izvaja ali je zaključena; preklic ni več mogoč. Osvežite seznam.",
      );
    return json({ cancelled: true });
  }
  if (path === "/api/admin/publish") {
    if (request.method !== "POST") fail(405, "Metoda ni dovoljena.");
    const data = await body(request, 6 * 1024 * 1024);
    return json(
      await publishSections(
        env,
        data.sections,
        data.revisions,
        session.email,
        fail,
      ),
    );
  }
  if (path === "/api/admin/publications") {
    if (request.method !== "GET") fail(405, "Metoda ni dovoljena.");
    const { results } = await env.DB.prepare(
      "SELECT id,created_at,actor,sections FROM cms_publications ORDER BY created_at DESC,id DESC LIMIT 20",
    ).all();
    // Listing remains bounded even when each publication contains several MiB.
    return json({
      items: results.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        actor: row.actor,
        sections: JSON.parse(row.sections),
      })),
    });
  }
  const match = path.match(/^\/api\/admin\/drafts\/([A-Za-z]+)$/);
  if (!match) return null;
  const section = match[1];
  if (section !== "website" && !CMS_SECTIONS.includes(section))
    fail(404, "Področje osnutka ne obstaja.");
  if (!env.DB) fail(503, "Shramba osnutkov ni dosegljiva.");
  if (request.method === "GET") {
    const queries = [
      env.DB.prepare(
        "SELECT value,base_revisions,revision,updated_at FROM cms_drafts WHERE owner_email=? AND section=?",
      ).bind(session.email, section),
    ];
    if (section === "website")
      queries.push(
        env.DB.prepare(
          "SELECT section,value FROM cms_draft_values WHERE owner_email=? AND draft_section=? ORDER BY section",
        ).bind(session.email, section),
      );
    const results = await env.DB.batch(queries),
      row = results[0].results?.[0];
    return json({
      draft: row
        ? {
            value:
              section === "website"
                ? websiteValue(results[1].results, fail)
                : JSON.parse(row.value),
            baseRevisions: JSON.parse(row.base_revisions),
            revision: row.revision,
            savedAt: row.updated_at,
          }
        : null,
    });
  }
  if (request.method === "DELETE") {
    const data = await body(request, 4096);
    if (!validRevision(data.revision))
      fail(400, "Različica osnutka ni veljavna.");
    const results = await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM cms_draft_values WHERE owner_email=? AND draft_section=? AND EXISTS(SELECT 1 FROM cms_drafts WHERE owner_email=? AND section=? AND revision=?)",
      ).bind(session.email, section, session.email, section, data.revision),
      env.DB.prepare(
        "DELETE FROM cms_drafts WHERE owner_email=? AND section=? AND revision=? RETURNING section",
      ).bind(session.email, section, data.revision),
    ]);
    if (
      !results[1].results?.length &&
      (await env.DB.prepare(
        "SELECT revision FROM cms_drafts WHERE owner_email=? AND section=?",
      )
        .bind(session.email, section)
        .first())
    )
      fail(
        409,
        "Osnutek je bil spremenjen v drugem oknu. Najprej ga ponovno odprite.",
      );
    return json({ deleted: true });
  }
  if (request.method !== "PUT") fail(405, "Metoda ni dovoljena.");
  const data = await body(request, 6 * 1024 * 1024);
  if (!validRevision(data.revision) || !object(data.baseRevisions))
    fail(400, "Različica osnutka ni veljavna.");
  const required = section === "website" ? websiteSections : [section];
  if (
    Object.keys(data.baseRevisions).some((key) => !required.includes(key)) ||
    required.some((key) => !validRevision(data.baseRevisions[key]))
  )
    fail(400, "Osnovne različice osnutka niso veljavne.");
  const value = draftValue(section, data.value, fail),
    updated = Date.now(),
    token = crypto.randomUUID();
  const queries = [
    env.DB.prepare(
      `INSERT INTO cms_drafts(owner_email,section,value,base_revisions,revision,updated_at,write_token) SELECT ?,?,?,?,1,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM cms_drafts WHERE owner_email=? AND section=? AND revision=?) ON CONFLICT(owner_email,section) DO UPDATE SET value=excluded.value,base_revisions=excluded.base_revisions,revision=cms_drafts.revision+1,updated_at=excluded.updated_at,write_token=excluded.write_token WHERE cms_drafts.revision=? RETURNING revision`,
    ).bind(
      session.email,
      section,
      section === "website" ? "{}" : JSON.stringify(value),
      JSON.stringify(data.baseRevisions),
      updated,
      token,
      data.revision,
      session.email,
      section,
      data.revision,
      data.revision,
    ),
  ];
  if (section === "website") {
    queries.push(
      env.DB.prepare(
        "DELETE FROM cms_draft_values WHERE owner_email=? AND draft_section=? AND EXISTS(SELECT 1 FROM cms_drafts WHERE owner_email=? AND section=? AND write_token=?)",
      ).bind(session.email, section, session.email, section, token),
    );
    for (const key of websiteSections)
      queries.push(
        env.DB.prepare(
          "INSERT INTO cms_draft_values(owner_email,draft_section,section,value) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM cms_drafts WHERE owner_email=? AND section=? AND write_token=?)",
        ).bind(
          session.email,
          section,
          key,
          JSON.stringify(value[key]),
          session.email,
          section,
          token,
        ),
      );
  }
  const results = await env.DB.batch(queries),
    row = results[0].results?.[0];
  if (!row)
    fail(
      409,
      "Osnutek je bil spremenjen v drugem oknu. Najprej ga ponovno odprite.",
    );
  return json({ revision: row.revision, savedAt: updated });
}
