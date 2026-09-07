import { notFound } from 'next/navigation';
import PublicNavbar from '../../components/public-navbar';
import AnnouncementDetail from '../../components/announcement-detail';
import { getPrincipal } from '../../../lib/authz';
import { getReadyDb } from '../../../lib/db';
import { isStaffRole, normalizeRole } from '../../../lib/roles';

export const dynamic = 'force-dynamic';

export default async function AnnouncementPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const [principal,sql]=await Promise.all([getPrincipal(),getReadyDb()]);
  const rows=await sql.query(`SELECT d.*,u.display_name,u.username,u.role,u.creator_rank,u.avatar_url FROM discussions d JOIN users u ON u.id=d.user_id WHERE d.id=$1 AND d.is_announcement=true AND d.status='VISIBLE' LIMIT 1`,[id]);
  if(!rows.length)notFound();
  if(principal)await sql.query(`INSERT INTO announcement_reads(announcement_id,user_id) VALUES($1,$2) ON CONFLICT(announcement_id,user_id) DO UPDATE SET read_at=now()`,[id,principal.id]);
  const row=rows[0];
  return <main><PublicNavbar returnTo={`/announcements/${id}`}/><AnnouncementDetail announcement={{id:String(row.id),title:String(row.title),summary:String(row.summary||''),content:String(row.content),imageUrl:row.image_url?`/api/discussions/${encodeURIComponent(String(row.id))}/image`:null,isGif:Boolean(row.is_gif),isPinned:Boolean(row.is_pinned),isLocked:Boolean(row.is_locked),reactionCount:Number(row.reaction_count||0),replyCount:Number(row.reply_count||0),createdAt:new Date(row.created_at as string).getTime(),updatedAt:new Date(row.updated_at as string).getTime(),author:{displayName:String(row.display_name),username:String(row.username),role:normalizeRole(row.role),creatorRank:String(row.creator_rank||'NEWCOMER'),avatarUrl:row.avatar_url?`/api/avatars/${encodeURIComponent(String(row.username))}?v=${encodeURIComponent(String(row.avatar_url))}`:''}}} canManage={Boolean(principal&&isStaffRole(principal.role))}/></main>;
}
