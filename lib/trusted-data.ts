import { getReadyDb } from './db';
import { ACTIVE_APPLICATIONS,trustedConfig } from './trusted-policy';
export async function trustedProgress(userId:string){
  const sql=await getReadyDb();
  const config=trustedConfig((await sql.query(`SELECT value FROM community_config WHERE key='trusted'`))[0].value);
  const rows=await sql.query(`SELECT u.role,u.status,FLOOR(EXTRACT(EPOCH FROM(now()-u.created_at))/86400)::int account_days,
    (SELECT count(*)::int FROM posts WHERE user_id=u.id AND status='VISIBLE') posts,
    (SELECT count(*)::int FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.user_id=u.id AND p.user_id<>u.id AND c.status='VISIBLE' AND p.status='VISIBLE') participation,
    EXISTS(SELECT 1 FROM report_cases c WHERE c.decision IN ('HIDE','DELETE') AND c.resolved_at>now()-($2::int*interval '1 day') AND
      ((c.target_type='PROFILE' AND c.target_id=u.id) OR (c.target_type='SKILLSHOT' AND EXISTS(SELECT 1 FROM posts p WHERE p.id=c.target_id AND p.user_id=u.id)) OR (c.target_type='COMMENT' AND EXISTS(SELECT 1 FROM comments p WHERE p.id=c.target_id AND p.user_id=u.id)))) violation
    FROM users u WHERE u.id=$1`,[userId,config.violationDays]);
  const stats=rows[0];
  const history=await sql.query(`SELECT id,kind,status,created_at,reviewed_at,public_note,version FROM trusted_contributor_applications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20`,[userId]);
  const application=history[0]||null,active=history.find(row=>ACTIVE_APPLICATIONS.includes(String(row.status)));
  const removal=(await sql.query(`SELECT created_at,metadata->>'publicNote' public_note FROM audit_logs WHERE target_id=$1 AND action='TRUSTED_CONTRIBUTOR_REVOKE' ORDER BY created_at DESC LIMIT 1`,[userId]))[0]||null;
  const cooldown=application&&['REJECTED','DISMISSED'].includes(String(application.status))?new Date(new Date(application.reviewed_at||application.created_at).getTime()+config.rejectionDays*86400000).toISOString():null;
  const removed=stats?.role==='USER'&&removal&&(!application||new Date(removal.created_at)>new Date(application.created_at));
  const appealBase=removed?removal:application;
  const appealAt=appealBase?new Date(new Date(appealBase.reviewed_at||appealBase.created_at).getTime()+config.appealDays*86400000).toISOString():null;
  const contributionMet=!!stats&&stats.account_days>=config.accountDays&&stats.posts>=config.posts&&stats.participation>=config.participation;
  const eligible=!!stats&&stats.status==='ACTIVE'&&stats.role==='USER'&&!stats.violation&&contributionMet&&!active&&(!cooldown||Date.now()>=new Date(cooldown).getTime());
  return {role:stats?.role,eligible,application,history,removed:!!removed,removalNote:removed?removal.public_note:null,cooldown,appealAt,
    appealEligible:config.appealsEnabled&&stats?.status==='ACTIVE'&&stats?.role==='USER'&&!active&&!!appealAt&&Date.now()>=new Date(appealAt).getTime()&&(removed||['REJECTED','DISMISSED'].includes(String(application?.status))),
    progress:{accountDays:{current:stats?.account_days||0,required:config.accountDays},posts:{current:stats?.posts||0,required:config.posts},participation:{current:stats?.participation||0,required:config.participation}},
    standing:stats?.violation?'Further community history is needed before applying.':'Community standing requirement met.'};
}
