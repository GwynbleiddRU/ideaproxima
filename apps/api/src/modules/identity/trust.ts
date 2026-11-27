import { sql } from "drizzle-orm";
import { KNOWLEDGE_ACTIONS } from "../shared/activity";
import type { Ctx } from "../shared/context";

/** Until plan 07 supplies decisions and appeals, the recorded dispositions are hides and deactivations.
 * A later restoration or reactivation cancels the corresponding disposition. */
export async function recomputeTrust(ctx: Ctx) {
  const contributions = sql.join(
    KNOWLEDGE_ACTIONS.map((action) => sql`${action}`),
    sql`, `,
  );
  await ctx.db.execute(sql`
    with dispositions as (
      select distinct on (a.subject_kind, a.subject_id) a.subject_kind, a.subject_id, a.action
      from activities a
      where a.action in ('moderation.hidden','moderation.restored','moderation.person_deactivated','moderation.person_reactivated')
        and a.occurred_at > now() - interval '90 days'
      order by a.subject_kind, a.subject_id, a.occurred_at desc, a.id desc
    ), affected as (
      select d.subject_id as person_id from dispositions d where d.action = 'moderation.person_deactivated'
      union
      select c.actor_id from dispositions d join activities c on c.subject_id = d.subject_id and c.subject_kind = d.subject_kind
      where d.action = 'moderation.hidden' and c.action in (${contributions})
    ), eligibility as (
      select a.person_id, (a.created_at <= now() - interval '30 days'
        and not exists (select 1 from affected d where d.person_id = a.person_id)
        and exists (select 1 from activities c where c.actor_id = a.person_id and c.action in (${contributions}) offset 9)
      ) as eligible from accounts a
    )
    update accounts set established_at = case when e.eligible then now() else null end
    from eligibility e where accounts.person_id = e.person_id and (accounts.established_at is not null) <> e.eligible
  `);
}
