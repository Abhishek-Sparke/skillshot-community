import { getReadyDb } from './db';
import { CREATOR_RANKS, creatorRankId, rankFromXp } from './creator-rank';
import { enqueueDiscordRankSync } from './discord-service';
export { XP_REWARDS, isMeaningfulComment, normalizeCommentForXp } from './xp-policy';
import { XP_REWARDS, isMeaningfulComment, normalizeCommentForXp } from './xp-policy';

export type XpEventType = keyof typeof XP_REWARDS | 'REVERSAL';

type Award = {
  userId: string;
  amount: number;
  eventType: XpEventType;
  reason: string;
  actionId: string;
  relatedType?: string;
  relatedId?: string;
  reversesEventId?: string;
};

/** Server-only, idempotent XP ledger write. Client supplied XP is never accepted. */
export async function awardXp(event: Award) {
  if (!event.userId || !event.actionId || !Number.isInteger(event.amount) || event.amount === 0) return { awarded: false };
  const sql = await getReadyDb();
  const rows = await sql.query(`WITH inserted AS (
      INSERT INTO xp_events(id,user_id,amount,event_type,reason,related_type,related_id,action_id,reverses_event_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(action_id) DO NOTHING RETURNING amount
    )
    UPDATE users SET creator_xp=greatest(0,creator_xp+(SELECT amount FROM inserted))
    WHERE id=$2 AND EXISTS(SELECT 1 FROM inserted)
    RETURNING creator_xp,creator_rank`, [
    crypto.randomUUID(), event.userId, event.amount, event.eventType, event.reason,
    event.relatedType || null, event.relatedId || null, event.actionId, event.reversesEventId || null,
  ]);
  if (!rows.length) return { awarded: false };
  const xp = Number(rows[0].creator_xp);
  const previousRank = creatorRankId(rows[0].creator_rank);
  const rank = rankFromXp(xp);
  if (rank.id !== previousRank) {
    await sql.query(`UPDATE users SET creator_rank=$2 WHERE id=$1`, [event.userId, rank.id]);
    if (rank.minXp > CREATOR_RANKS[previousRank].minXp) {
      await sql.query(`INSERT INTO notifications(id,user_id,type,title,body,event_key,target_url)
        VALUES($1,$2,'RANK_UP',$3,$4,$5,'/profile') ON CONFLICT DO NOTHING`, [
        crypto.randomUUID(), event.userId, `You reached ${rank.label}`, `Your Creator Rank is now ${rank.label}.`, `rank-up:${event.userId}:${rank.id}`,
      ]);
    }
    enqueueDiscordRankSync(event.userId, rank.id).catch(() => {});
  }
  return { awarded: true, xp, rank: rank.id };
}

export async function reverseXp(actionId: string, reason: string) {
  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT id,user_id,amount,related_type,related_id FROM xp_events WHERE action_id=$1 AND amount>0 LIMIT 1`, [actionId]);
  if (!rows.length) return { awarded: false };
  const source = rows[0];
  return awardXp({
    userId: String(source.user_id), amount: -Number(source.amount), eventType: 'REVERSAL', reason,
    actionId: `reverse:${actionId}`, relatedType: source.related_type || undefined,
    relatedId: source.related_id || undefined, reversesEventId: String(source.id),
  });
}

export async function awardCommentXp(commentId: string) {
  const sql = await getReadyDb();
  const rows = await sql.query(`SELECT c.id,c.user_id,c.body,c.created_at,p.user_id owner_id
    FROM comments c JOIN posts p ON p.id=c.post_id
    WHERE c.id=$1 AND c.status='VISIBLE' AND p.status='VISIBLE' LIMIT 1`, [commentId]);
  if (!rows.length || !isMeaningfulComment(String(rows[0].body))) return { eligible: false };
  const comment = rows[0];
  const recent = await sql.query(`SELECT c.id,c.body,c.created_at FROM comments c
    WHERE c.user_id=$1 AND c.id<>$2 AND c.status='VISIBLE' AND c.created_at>now()-interval '24 hours'
    ORDER BY c.created_at DESC LIMIT 50`, [comment.user_id, commentId]);
  const normalized = normalizeCommentForXp(String(comment.body));
  if (recent.some(row => normalizeCommentForXp(String(row.body)) === normalized)) return { eligible: false };
  if (recent.some(row => Math.abs(new Date(row.created_at as string).getTime() - new Date(comment.created_at as string).getTime()) < 15_000)) return { eligible: false };
  const hourly = await sql.query(`SELECT count(*) count FROM xp_events WHERE user_id=$1 AND event_type='COMMENT_CREATED' AND created_at>now()-interval '1 hour'`, [comment.user_id]);
  if (Number(hourly[0]?.count || 0) >= 10) return { eligible: false };
  await awardXp({ userId:String(comment.user_id), amount:XP_REWARDS.COMMENT_CREATED, eventType:'COMMENT_CREATED', reason:'Meaningful comment', actionId:`comment-created:${commentId}`, relatedType:'COMMENT', relatedId:commentId });
  if (comment.owner_id !== comment.user_id) await awardXp({ userId:String(comment.owner_id), amount:XP_REWARDS.COMMENT_RECEIVED, eventType:'COMMENT_RECEIVED', reason:'Received a meaningful comment', actionId:`comment-received:${commentId}`, relatedType:'COMMENT', relatedId:commentId });
  return { eligible: true };
}

export async function reverseCommentXp(commentId: string, reason = 'Comment removed') {
  await Promise.all([reverseXp(`comment-created:${commentId}`, reason), reverseXp(`comment-received:${commentId}`, reason)]);
}

export async function reverseRelatedXp(relatedType:string,relatedId:string,reason:string){
  const rows=await (await getReadyDb()).query(`SELECT action_id FROM xp_events WHERE related_type=$1 AND related_id=$2 AND amount>0`,[relatedType,relatedId]);
  await Promise.all(rows.map(row=>reverseXp(String(row.action_id),reason)));
}
