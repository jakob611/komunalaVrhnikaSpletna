import { emailEnabled, outboxInsert } from "./email.js";

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const encoder = new TextEncoder();
async function sha256(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

// The random request ID is a retry capability. Store only a content digest and a
// non-personal receipt beside it; neither email nor the supplied body is returned.
export async function submissionAttempt(requestId, kind, payload, upload) {
  if (requestId == null || requestId === "") return null; // Existing clients remain compatible.
  if (
    typeof requestId !== "string" ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId)
  )
    fail(400, "Oznaka oddaje ni veljavna. Osvežite obrazec.");
  const { photoKey: _photoKey, ...fields } = payload;
  const photo = upload
    ? { type: upload.type, digest: await sha256(upload.bytes) }
    : null;
  return {
    requestId: requestId.toLowerCase(),
    kind,
    fingerprint: await sha256(JSON.stringify({ kind, fields, photo })),
  };
}

export async function completedSubmission(env, attempt) {
  if (!attempt || !env.DB) return null;
  const row = await env.DB.prepare(
    "SELECT fingerprint,kind,receipt,submission_id FROM public_submission_requests WHERE request_id=?",
  )
    .bind(attempt.requestId)
    .first();
  if (!row) return null;
  if (row.kind !== attempt.kind || row.fingerprint !== attempt.fingerprint)
    fail(
      409,
      "Oznaka oddaje je že uporabljena za drugo vsebino. Osvežite obrazec in preverite prejšnjo oddajo.",
    );
  return { receipt: JSON.parse(row.receipt), submissionId: row.submission_id };
}

export async function savePublicSubmission(
  env,
  store,
  record,
  attempt,
  receipt,
) {
  if (!attempt || !env.DB) {
    await store.save(record);
    return { receipt, submissionId: record.id };
  }
  const table =
    record.kind === "contact" ? "contact_submissions" : "submissions";
  const statements = [
    env.DB.prepare(
      "INSERT INTO public_submission_requests(request_id,fingerprint,submission_id,kind,receipt,created_at) VALUES(?,?,?,?,?,?)",
    ).bind(
      attempt.requestId,
      attempt.fingerprint,
      record.id,
      record.kind,
      JSON.stringify(receipt),
      Date.parse(record.createdAt),
    ),
    env.DB.prepare(
      `INSERT INTO ${table}(id,kind,created_at,status,payload) VALUES(?,?,?,?,?)`,
    ).bind(
      record.id,
      record.kind,
      record.createdAt,
      record.status,
      JSON.stringify(record.payload),
    ),
  ];
  if (emailEnabled(env))
    statements.push(await outboxInsert(env.DB, record, env));
  try {
    // D1 rolls back the entire batch on a duplicate request key. A racing retry
    // therefore cannot create a second case or queue another email.
    await env.DB.batch(statements);
    return { receipt, submissionId: record.id };
  } catch (error) {
    const completed = await completedSubmission(env, attempt);
    if (completed) return completed;
    throw error;
  }
}

// Do not delete a possibly committed photo after an uncertain database failure.
// An unreferenced object is safer than a saved citizen report with a broken photo.
export async function discardUncommittedPhoto(env, store, record) {
  if (!record.payload.photoKey) return;
  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT id FROM submissions WHERE id=?")
        .bind(record.id)
        .first();
      if (row) return;
    } catch {
      return;
    }
  }
  await store.deletePhoto(record.payload.photoKey);
}
