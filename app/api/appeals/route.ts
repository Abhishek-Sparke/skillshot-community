import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { rateLimit } from '../../../lib/rate-limit';

export async function GET() {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const appeals = await (await getReadyDb()).query(`SELECT id,target_type,target_id,reason,explanation,status,created_at,reviewed_at FROM appeals WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [auth.principal.id]);
  return Response.json({ appeals });
}

export async function POST(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  if (!await rateLimit(`appeal:${auth.principal.id}`, 4, 86400)) return Response.json({ error: 'Appeal limit reached. Please try again tomorrow.' }, { status: 429 });
  const body = await request.json();
  const targetType = String(body.targetType || '').toUpperCase();
  const targetId = String(body.targetId || '').trim();
  const reason = String(body.reason || '').trim().slice(0, 120);
  const explanation = String(body.explanation || '').trim().slice(0, 1500);
  if (!['SKILLSHOT','COMMENT','ACCOUNT'].includes(targetType) || !targetId || reason.length < 4 || explanation.length < 20) return Response.json({ error: 'Please complete all appeal details.' }, { status: 400 });
  const sql = await getReadyDb();
  const duplicate = await sql.query(`SELECT id FROM appeals WHERE user_id=$1 AND target_type=$2 AND target_id=$3 AND status IN ('PENDING','UNDER_REVIEW') LIMIT 1`, [auth.principal.id,targetType,targetId]);
  if (duplicate.length) return Response.json({ error: 'An appeal for this item is already being reviewed.' }, { status: 409 });
  const id = crypto.randomUUID();
  if (targetType === 'SKILLSHOT') {
    const inserted = await sql.query(`WITH target AS (
      UPDATE posts SET appeal_hold=true WHERE id=$4 AND user_id=$2 AND status NOT IN ('PURGING','PURGED') RETURNING id
    ) INSERT INTO appeals(id,user_id,target_type,target_id,reason,explanation)
      SELECT $1,$2,$3,$4,$5,$6 FROM target RETURNING id`, [id,auth.principal.id,targetType,targetId,reason,explanation]);
    if (!inserted.length) return Response.json({ error:'This Skillshot is unavailable for appeal.' }, { status:409 });
  } else await sql.query(`INSERT INTO appeals(id,user_id,target_type,target_id,reason,explanation) VALUES($1,$2,$3,$4,$5,$6)`, [id,auth.principal.id,targetType,targetId,reason,explanation]);
  await sql.query(`INSERT INTO notifications(id,audience,type,title,body) VALUES($1,'STAFF','NEW_APPEAL','New appeal awaiting review',$2)`, [crypto.randomUUID(),`${targetType}: ${reason}`]);
  return Response.json({ id }, { status: 201 });
}
