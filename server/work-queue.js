import { ljubljanaDate } from "./seed.js";

const statuses = ["demo-saved", "in-progress", "resolved", "spam"];
const priorities = ["low", "normal", "high", "urgent"];
const allSubmissions =
  "(SELECT * FROM submissions UNION ALL SELECT * FROM contact_submissions)";
const joined = `SELECT s.*, c.priority, c.assignee, c.due_date, c.notes, c.checklist, c.version, c.updated_at, e.status AS email_status
  FROM ${allSubmissions} s LEFT JOIN admin_cases c ON c.submission_id = s.id LEFT JOIN email_outbox e ON e.id = s.id`;
const steps = {
  reports: [
    "Preveri opis, lokacijo in priloženo fotografijo",
    "Določi odgovorno osebo in uredi prijavljeno težavo",
    "Preveri izvedbo in zaključi obravnavo",
  ],
  contact: [
    "Preberi sporočilo in določi pristojno področje",
    "Pripravi odgovor oziroma naslednji korak",
    "Preveri odgovor in zaključi obravnavo",
  ],
  requests: [
    "Preveri lokacijo in želeno storitev",
    "Uskladi pogoje, ceno in termin",
    "Zabeleži dogovor in zaključi obravnavo",
  ],
  market: [
    "Preveri datum in podatke ponudnika",
    "Preveri razpoložljivost in uskladi pogoje",
    "Zabeleži odločitev in obvesti ponudnika",
  ],
  subscriptions: [
    "Preveri podatke in izbrane teme",
    "Preveri možnosti vključitve v sistem obvestil",
    "Zabeleži izid preverjanja",
  ],
};
export function workItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    createdAt: row.created_at,
    status: row.status,
    payload: JSON.parse(row.payload),
    priority: row.priority || "normal",
    assignee: row.assignee || "",
    dueDate: row.due_date || "",
    notes: row.notes || "",
    version: row.version || 0,
    updatedAt: row.updated_at || row.created_at,
    notificationStatus: row.email_status || "not-queued",
    checklist: row.checklist
      ? JSON.parse(row.checklist)
      : (steps[row.kind] || steps.contact).map((text, index) => ({
          id: `step-${index + 1}`,
          text,
          done: false,
        })),
  };
}
export async function getWorkItem(env, id, fail) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id))
    fail(404, "Delovni nalog ne obstaja.");
  const row = await env.DB.prepare(`${joined} WHERE s.id = ? LIMIT 1`)
    .bind(id)
    .first();
  if (!row) fail(404, "Delovni nalog ne obstaja.");
  return workItem(row);
}
async function timeline(env, id) {
  const { results } = await env.DB.prepare(
    "SELECT id,created_at AS createdAt,event,detail FROM admin_case_events WHERE submission_id = ? ORDER BY created_at DESC,id DESC LIMIT 100",
  )
    .bind(id)
    .all();
  return results;
}
function validate(data, fail) {
  const text = (key, max) => {
    if (
      typeof data[key] !== "string" ||
      data[key].length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(data[key])
    )
      fail(400, `Preverite podatek: ${key}.`);
    return data[key].trim();
  };
  if (!Number.isSafeInteger(data.version) || data.version < 0)
    fail(400, "Različica naloga ni veljavna.");
  if (!statuses.includes(data.status) || !priorities.includes(data.priority))
    fail(400, "Izberite veljavno stanje in prioriteto.");
  const assignee = text("assignee", 120),
    notes = text("notes", 5000),
    dueDate = text("dueDate", 10);
  if (
    dueDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
      !Number.isFinite(Date.parse(`${dueDate}T12:00:00Z`)) ||
      new Date(`${dueDate}T12:00:00Z`).toISOString().slice(0, 10) !== dueDate)
  )
    fail(400, "Rok ni veljaven datum.");
  if (!Array.isArray(data.checklist) || data.checklist.length > 30)
    fail(400, "Seznam lahko vsebuje največ 30 korakov.");
  const ids = new Set();
  const checklist = data.checklist.map((step) => {
    if (
      !step ||
      typeof step !== "object" ||
      typeof step.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(step.id) ||
      ids.has(step.id) ||
      typeof step.text !== "string" ||
      !step.text.trim() ||
      step.text.length > 300 ||
      typeof step.done !== "boolean"
    )
      fail(400, "Preverite korake na seznamu.");
    ids.add(step.id);
    return { id: step.id, text: step.text.trim(), done: step.done };
  });
  if (
    data.status === "resolved" &&
    (!checklist.length || checklist.some((step) => !step.done))
  )
    fail(
      400,
      "Pred zaključkom označite vse korake kot opravljene. Neuporabne korake lahko odstranite.",
    );
  return { ...data, assignee, notes, dueDate, checklist };
}
export async function saveWorkItem(env, id, raw, fail) {
  const previous = await getWorkItem(env, id, fail);
  const data = validate(raw, fail);
  const token = crypto.randomUUID(),
    at = new Date().toISOString();
  const table =
    previous.kind === "contact" ? "contact_submissions" : "submissions";
  const progress = `${data.checklist.filter((step) => step.done).length}/${data.checklist.length}`;
  const labels = {
    "demo-saved": "Novo",
    "in-progress": "V obravnavi",
    resolved: "Zaključeno",
    spam: "Neželena oddaja",
    low: "Nizka",
    normal: "Običajna",
    high: "Visoka",
    urgent: "Nujna",
  };
  const changes = [
    previous.status !== data.status ? `Stanje: ${labels[data.status]}` : "",
    previous.priority !== data.priority
      ? `Prioriteta: ${labels[data.priority]}`
      : "",
    previous.assignee !== data.assignee
      ? `Odgovorna oseba: ${data.assignee || "nedoločena"}`
      : "",
    previous.dueDate !== data.dueDate
      ? `Rok: ${data.dueDate || "ni določen"}`
      : "",
    previous.notes !== data.notes ? "Posodobljene interne opombe" : "",
    `Opravljeni koraki: ${progress}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const result = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO admin_cases(submission_id,priority,assignee,due_date,notes,checklist,version,updated_at,update_token)
      SELECT ?,?,?,?,?,?,?,?,? WHERE ? = 0 OR EXISTS(SELECT 1 FROM admin_cases WHERE submission_id = ?)
      ON CONFLICT(submission_id) DO UPDATE SET priority=excluded.priority,assignee=excluded.assignee,due_date=excluded.due_date,
        notes=excluded.notes,checklist=excluded.checklist,version=excluded.version,updated_at=excluded.updated_at,update_token=excluded.update_token
      WHERE admin_cases.version = excluded.version - 1 RETURNING version`,
    ).bind(
      id,
      data.priority,
      data.assignee,
      data.dueDate,
      data.notes,
      JSON.stringify(data.checklist),
      data.version + 1,
      at,
      token,
      data.version,
      id,
    ),
    env.DB.prepare(
      `UPDATE ${table} SET status = ? WHERE id = ? AND EXISTS(SELECT 1 FROM admin_cases WHERE submission_id = ? AND update_token = ?)`,
    ).bind(data.status, id, id, token),
    env.DB.prepare(
      `INSERT INTO admin_case_events(id,submission_id,created_at,event,detail)
      SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_cases WHERE submission_id = ? AND update_token = ?)`,
    ).bind(
      crypto.randomUUID(),
      id,
      at,
      previous.status !== data.status ? "status" : "updated",
      changes,
      id,
      token,
    ),
  ]);
  if (!result[0].results?.length)
    fail(
      409,
      "Nalog je medtem spremenil drug skrbnik. Osvežite ga, preden shranite spremembe.",
    );
  return {
    item: await getWorkItem(env, id, fail),
    timeline: await timeline(env, id),
  };
}

// The parent admin router authenticates the session and checks CSRF before dispatch.
export async function handleWork(request, env, { json, body, fail }) {
  const url = new URL(request.url);
  if (url.pathname === "/api/admin/work") {
    if (request.method !== "GET") fail(405, "Metoda ni dovoljena.");
    const kind = url.searchParams.get("kind") || "",
      status = url.searchParams.get("status") || "open",
      priority = url.searchParams.get("priority") || "";
    const page = Number(url.searchParams.get("page") || 1);
    const query = (url.searchParams.get("q") || "")
      .trim()
      .slice(0, 150)
      .replace(/[\\%_]/g, "\\$&");
    if (
      (kind && !Object.keys(steps).includes(kind)) ||
      !["open", "all", ...statuses].includes(status) ||
      (priority && !priorities.includes(priority)) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 10000
    )
      fail(400, "Preverite filtre nalogov.");
    const where = `WHERE (?='' OR s.kind=?) AND (?='all' OR (?='open' AND s.status IN ('demo-saved','in-progress')) OR s.status=?)
      AND (?='' OR COALESCE(c.priority,'normal')=?) AND (?=0 OR (c.due_date<>'' AND c.due_date<? AND s.status IN ('demo-saved','in-progress')))
      AND (?='' OR (s.payload LIKE ? ESCAPE '\\' OR s.id LIKE ? ESCAPE '\\'))`;
    const { results } = await env.DB.prepare(
      `${joined} ${where}
      ORDER BY CASE COALESCE(c.priority,'normal') WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,s.created_at DESC,s.id DESC LIMIT 21 OFFSET ?`,
    )
      .bind(
        kind,
        kind,
        status,
        status,
        status,
        priority,
        priority,
        url.searchParams.get("overdue") === "true" ? 1 : 0,
        ljubljanaDate(),
        query,
        `%${query}%`,
        `%${query}%`,
        (page - 1) * 20,
      )
      .all();
    const stats = await env.DB.prepare(
      `SELECT
      COALESCE(SUM(s.status IN ('demo-saved','in-progress')),0) AS open,
      COALESCE(SUM(s.status='demo-saved'),0) AS new,
      COALESCE(SUM(s.status='in-progress'),0) AS inProgress,
      COALESCE(SUM(s.status='resolved'),0) AS resolved,
      COALESCE(SUM(e.status='failed'),0) AS notificationFailed,
      COALESCE(SUM(c.due_date<>'' AND c.due_date<? AND s.status IN ('demo-saved','in-progress')),0) AS overdue
      FROM ${allSubmissions} s LEFT JOIN admin_cases c ON c.submission_id=s.id LEFT JOIN email_outbox e ON e.id=s.id`,
    )
      .bind(ljubljanaDate())
      .first();
    return json({
      items: results.slice(0, 20).map(workItem),
      hasMore: results.length > 20,
      stats,
    });
  }
  const match = url.pathname.match(/^\/api\/admin\/work\/([^/]+)$/);
  if (!match) return null;
  if (request.method === "GET")
    return json({
      item: await getWorkItem(env, match[1], fail),
      timeline: await timeline(env, match[1]),
    });
  if (request.method === "PUT")
    return json(
      await saveWorkItem(env, match[1], await body(request, 65536), fail),
    );
  fail(405, "Metoda ni dovoljena.");
}
