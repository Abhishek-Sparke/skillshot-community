import { NextResponse } from 'next/server';
import { getReadyDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = await getReadyDb();

  // 1. Fetch current active challenge
  const challengeRows = await sql.query(`
    SELECT id, title, prompt, category, xp_bonus, badge_icon, tag, starts_at, ends_at, status
    FROM challenges
    WHERE status = 'ACTIVE' AND now() BETWEEN starts_at AND ends_at
    ORDER BY starts_at DESC
    LIMIT 1
  `);

  if (!challengeRows.length) {
    // Fallback: any active challenge
    const fallbackRows = await sql.query(`
      SELECT id, title, prompt, category, xp_bonus, badge_icon, tag, starts_at, ends_at, status
      FROM challenges
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (!fallbackRows.length) {
      return NextResponse.json({ challenge: null, submissions: [] });
    }
    challengeRows.push(fallbackRows[0]);
  }

  const challenge = challengeRows[0];
  const tag = String(challenge.tag || 'challenge').toLowerCase();

  // 2. Fetch submissions matching this challenge's tag or category
  const submissionRows = await sql.query(`
    SELECT p.id, p.title, p.category, p.created_at, p.image_width, p.image_height,
      u.username, u.display_name, u.avatar_url, u.creator_rank,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.status = 'VISIBLE' AND u.status = 'ACTIVE'
      AND (
        EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(p.tags) t
          WHERE lower(t) = $1 OR lower(t) = 'challenge'
        )
        OR lower(p.category) = lower($2)
      )
    ORDER BY p.created_at DESC
    LIMIT 6
  `, [tag, String(challenge.category)]);

  return NextResponse.json({
    challenge: {
      id: String(challenge.id),
      title: String(challenge.title),
      prompt: String(challenge.prompt),
      category: String(challenge.category),
      xpBonus: Number(challenge.xp_bonus),
      badgeIcon: String(challenge.badge_icon),
      tag: String(challenge.tag),
      startsAt: challenge.starts_at,
      endsAt: challenge.ends_at,
      status: String(challenge.status),
    },
    submissions: submissionRows.map(row => ({
      id: String(row.id),
      title: String(row.title),
      category: String(row.category),
      author: String(row.display_name || row.username),
      username: String(row.username),
      creatorRank: String(row.creator_rank || 'NEWCOMER'),
      reactionCount: Number(row.reaction_count || 0),
      imageUrl: `/api/images/${row.id}?variant=thumbnail`,
    })),
  });
}
