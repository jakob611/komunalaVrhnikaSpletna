import { publishSections, scheduledValues } from "./cms-editor.js";
import { ljubljanaDate } from "./seed.js";

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const leaseDuration = 5 * 60000;

async function creatorMayPublish(env, email) {
  const person = await env.DB.prepare(
    "SELECT u.status,u.role,p.access_scope FROM admin_users u LEFT JOIN admin_user_permissions p ON p.email=u.email WHERE u.email=?",
  )
    .bind(email)
    .first();
  return (
    person?.status === "active" &&
    (person.role === "owner" ||
      ["all", "content"].includes(person.access_scope || "all"))
  );
}

/** A schedule stores an immutable draft snapshot and expected public revisions.
 * Claims are bounded and recoverable. A deterministic publication ID reconciles
 * a committed publication after a crash before its schedule was acknowledged.
 */
export async function processScheduledPublications(env, now = Date.now()) {
  const result = { published: 0, failed: 0, retrying: 0 };
  if (!env.DB) return result;
  const today = ljubljanaDate(new Date(now));
  const { results } = await env.DB.prepare(
    "SELECT id FROM cms_scheduled_publications WHERE publish_on<=? AND (status='pending' OR (status='running' AND lease_until<=?)) ORDER BY publish_on,created_at,id LIMIT 10",
  )
    .bind(today, now)
    .all();
  for (const candidate of results) {
    const lease = now + leaseDuration;
    const schedule = await env.DB.prepare(
      "UPDATE cms_scheduled_publications SET status='running',lease_until=?,updated_at=?,error=NULL WHERE id=? AND publish_on<=? AND (status='pending' OR (status='running' AND lease_until<=?)) RETURNING *",
    )
      .bind(lease, now, candidate.id, today, now)
      .first();
    if (!schedule) continue;
    const complete = async () => {
      await env.DB.prepare(
        "UPDATE cms_scheduled_publications SET status='published',lease_until=0,updated_at=?,error=NULL WHERE id=? AND status='running' AND lease_until=?",
      )
        .bind(now, schedule.id, lease)
        .run();
      result.published++;
    };
    let values, revisions;
    try {
      values = await scheduledValues(env, schedule, fail);
      revisions = JSON.parse(schedule.base_revisions);
      // A previous executor may have committed before losing its acknowledgement.
      const previous = await env.DB.prepare(
        "SELECT id FROM cms_publications WHERE id=?",
      )
        .bind(schedule.publication_id)
        .first();
      if (!previous && !(await creatorMayPublish(env, schedule.created_by)))
        fail(
          403,
          "Načrtovana objava ni bila izvedena: njen avtor nima več aktivnega dostopa do urejanja vsebin.",
        );
      await publishSections(
        env,
        values,
        revisions,
        schedule.created_by,
        fail,
        schedule.publication_id,
      );
      await complete();
    } catch (error) {
      // Even a failed response can follow a committed transaction. Reconcile it
      // before declaring a conflict or retrying; never overwrite a later edit.
      try {
        const previous = await env.DB.prepare(
          "SELECT id FROM cms_publications WHERE id=?",
        )
          .bind(schedule.publication_id)
          .first();
        if (previous && values && revisions) {
          await publishSections(
            env,
            values,
            revisions,
            schedule.created_by,
            fail,
            schedule.publication_id,
          );
          await complete();
          continue;
        }
      } catch {
        /* Keep the lease recoverable if storage is still unavailable. */
      }
      if (
        [400, 403, 409].includes(error?.status) ||
        error instanceof SyntaxError
      ) {
        const message =
          error instanceof SyntaxError
            ? "Shranjeni osnutek ni veljaven. Ponovno pripravite načrtovano objavo."
            : error.message;
        await env.DB.prepare(
          "UPDATE cms_scheduled_publications SET status='failed',lease_until=0,updated_at=?,error=? WHERE id=? AND status='running' AND lease_until=?",
        )
          .bind(now, message, schedule.id, lease)
          .run();
        result.failed++;
      } else {
        // Leave running until the lease expires; the next cron recovers it.
        result.retrying++;
        console.error(JSON.stringify({ event: "scheduled_publication_retry" }));
      }
    }
  }
  return result;
}
