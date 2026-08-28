import { requirePrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { rateLimit } from '../../../lib/rate-limit';

export async function GET() {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  const sql = await getReadyDb();
  const [stats, latest] = await Promise.all([
    sql.query(`SELECT (SELECT count(*) FROM posts WHERE user_id=$1 AND status='VISIBLE') posts,(SELECT count(*) FROM reactions r JOIN posts p ON p.id=r.post_id WHERE p.user_id=$1) likes,created_at FROM users WHERE id=$1`, [auth.principal.id]),
    sql.query(`SELECT id,status,created_at,review_note FROM trusted_contributor_applications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [auth.principal.id]),
  ]);
  const accountDays = stats.length ? Math.floor((Date.now()-new Date(stats[0].created_at).getTime())/86400000) : 0;
  const eligible = Number(stats[0]?.posts || 0) >= 3 && accountDays >= 7 && auth.principal.role === 'USER';
  return Response.json({ role:auth.principal.role, eligible, requirements:{ posts:Number(stats[0]?.posts||0), accountDays }, application:latest[0] || null });
}

export async function POST(request: Request) {
  const auth = await requirePrincipal();
  if ('error' in auth) return auth.error;
  if (auth.principal.role !== 'USER') return Response.json({ error: 'This account already has a special role.' }, { status: 409 });
  if (!await rateLimit(`trusted-application:${auth.principal.id}`, 2, 2592000)) return Response.json({ error: 'Please wait before applying again.' }, { status: 429 });
  const body = await request.json();
  const reason = String(body.reason||'').trim().slice(0,1000), contribution=String(body.contribution||'').trim().slice(0,1000), portfolio=String(body.portfolioUrl||'').trim().slice(0,300);
  if (reason.length<30 || contribution.length<30) return Response.json({ error:'Please give a little more detail in both answers.' },{status:400});
  if (portfolio) { try { const url=new URL(portfolio); if (!['http:','https:'].includes(url.protocol)) throw new Error(); } catch { return Response.json({error:'Enter a valid portfolio URL.'},{status:400}); } }
  const sql=await getReadyDb();
  const stats=await sql.query(`SELECT count(*) posts FROM posts WHERE user_id=$1 AND status='VISIBLE'`,[auth.principal.id]);
  const user=await sql.query(`SELECT created_at FROM users WHERE id=$1`,[auth.principal.id]);
  if (Number(stats[0]?.posts||0)<3 || !user.length || Date.now()-new Date(user[0].created_at).getTime()<7*86400000) return Response.json({error:'Publish at least 3 Skillshots and keep your account active for 7 days before applying.'},{status:403});
  const pending=await sql.query(`SELECT id FROM trusted_contributor_applications WHERE user_id=$1 AND status='PENDING' LIMIT 1`,[auth.principal.id]);
  if(pending.length)return Response.json({error:'Your application is already under review.'},{status:409});
  const id=crypto.randomUUID(); await sql.query(`INSERT INTO trusted_contributor_applications(id,user_id,reason,contribution,portfolio_url)VALUES($1,$2,$3,$4,$5)`,[id,auth.principal.id,reason,contribution,portfolio]);
  await sql.query(`INSERT INTO notifications(id,audience,type,title,body)VALUES($1,'STAFF','TRUSTED_APPLICATION','Trusted Contributor application','A new application is ready for review.')`,[crypto.randomUUID()]);
  return Response.json({id},{status:201});
}
