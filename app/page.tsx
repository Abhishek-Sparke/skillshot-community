import { Suspense } from 'react';
import Link from 'next/link';
import HomeFresh, { HomeFreshSkeleton } from './components/home-fresh';
import PublicNavbar from './components/public-navbar';
import SideIconRail from './components/side-icon-rail';
import CreatorUsername from './components/creator-username';
import { getChatGPTUser } from './chatgpt-auth';
import { signInPath } from '../lib/auth-path';
import { getReadyDb } from '../lib/db';
import { normalizeRole, type UserRole } from '../lib/roles';
import type { CreatorRankId } from '../lib/creator-rank';

export const dynamic = 'force-dynamic';

const SKILL_CATEGORIES = [
  { name: 'Photography', icon: '📷', query: 'Photography' },
  { name: 'Design', icon: '🎨', query: 'Design' },
  { name: 'Coding', icon: '💻', query: 'Coding' },
  { name: 'Art', icon: '🖌️', query: 'Art' },
  { name: 'Animation', icon: '🎬', query: 'Animation' },
  { name: 'Gaming', icon: '🎮', query: 'Gaming' },
  { name: 'Writing', icon: '✍️', query: 'Writing' },
  { name: 'More', icon: '✦', href: '/community' },
];

export default async function Home() {
  const signedIn = Boolean(await getChatGPTUser());

  let featuredCreator: {
    id: string;
    username: string;
    displayName: string;
    role: UserRole;
    avatarUrl: string;
    bannerUrl: string;
    bio: string;
    creatorRank: CreatorRankId;
    postCount: number;
  } | null = null;

  let featuredCreatorWorks: Array<{
    id: string;
    title: string;
    category: string;
    imageWidth: number;
    imageHeight: number;
    imageType: string;
  }> = [];

  let standoutShot: {
    id: string;
    title: string;
    description: string;
    category: string;
    skills: string[];
    imageWidth: number;
    imageHeight: number;
    imageType: string;
    reactionCount: number;
    commentCount: number;
    author: {
      displayName: string;
      username: string;
      role: UserRole;
      avatarUrl: string;
      creatorRank: CreatorRankId;
    };
  } | null = null;

  try {
    const sql = await getReadyDb();

    // 1. Featured Creator (top active creator with visible work)
    const creatorRows = await sql.query(`
      SELECT u.id, u.username, u.display_name, u.role, u.avatar_url, u.banner_url, u.bio, u.creator_rank,
        (SELECT count(*) FROM posts p WHERE p.user_id = u.id AND p.status = 'VISIBLE') AS post_count
      FROM users u
      WHERE u.status = 'ACTIVE'
        AND EXISTS (SELECT 1 FROM posts p WHERE p.user_id = u.id AND p.status = 'VISIBLE')
      ORDER BY u.creator_xp DESC, post_count DESC
      LIMIT 1
    `);

    if (creatorRows.length) {
      const c = creatorRows[0];
      featuredCreator = {
        id: String(c.id),
        username: String(c.username),
        displayName: String(c.display_name || c.username),
        role: normalizeRole(c.role),
        avatarUrl: c.avatar_url ? `/api/avatars/${encodeURIComponent(String(c.username))}?v=${encodeURIComponent(String(c.avatar_url))}` : '',
        bannerUrl: c.banner_url ? `/api/banners/${encodeURIComponent(String(c.username))}?v=${encodeURIComponent(String(c.banner_url))}` : '',
        bio: String(c.bio || ''),
        creatorRank: (c.creator_rank as CreatorRankId) || 'NEWCOMER',
        postCount: Number(c.post_count || 0),
      };

      const workRows = await sql.query(`
        SELECT p.id, p.title, p.category, p.image_width, p.image_height, p.image_type
        FROM posts p
        WHERE p.user_id = $1 AND p.status = 'VISIBLE'
        ORDER BY p.created_at DESC
        LIMIT 3
      `, [c.id]);

      featuredCreatorWorks = workRows.map(w => ({
        id: String(w.id),
        title: String(w.title),
        category: String(w.category || ''),
        imageWidth: Number(w.image_width) || 640,
        imageHeight: Number(w.image_height) || 480,
        imageType: String(w.image_type || 'image/webp'),
      }));
    }

    // 2. Skillshot of the Week (top reacted standout visible post)
    const standoutRows = await sql.query(`
      SELECT p.id, p.title, p.description, p.category, p.skills, p.image_width, p.image_height, p.image_type,
        (SELECT count(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
        (SELECT count(*) FROM comments com WHERE com.post_id = p.id AND com.status = 'VISIBLE') AS comment_count,
        u.display_name, u.username, u.role, u.avatar_url, u.creator_rank
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.status = 'VISIBLE' AND u.status = 'ACTIVE'
      ORDER BY ((SELECT count(*) FROM reactions r WHERE r.post_id = p.id) * 3 + (SELECT count(*) FROM comments com WHERE com.post_id = p.id AND com.status = 'VISIBLE') * 2) DESC, p.created_at DESC
      LIMIT 1
    `);

    if (standoutRows.length) {
      const s = standoutRows[0];
      let skillsList: string[] = [];
      try {
        if (Array.isArray(s.skills)) {
          skillsList = s.skills.map(String);
        } else if (typeof s.skills === 'string') {
          skillsList = JSON.parse(s.skills);
        }
      } catch {
        skillsList = [];
      }

      standoutShot = {
        id: String(s.id),
        title: String(s.title),
        description: String(s.description || ''),
        category: String(s.category || 'Creative'),
        skills: skillsList.slice(0, 3),
        imageWidth: Number(s.image_width) || 800,
        imageHeight: Number(s.image_height) || 600,
        imageType: String(s.image_type || 'image/webp'),
        reactionCount: Number(s.reaction_count || 0),
        commentCount: Number(s.comment_count || 0),
        author: {
          displayName: String(s.display_name || s.username),
          username: String(s.username),
          role: normalizeRole(s.role),
          avatarUrl: s.avatar_url ? `/api/avatars/${encodeURIComponent(String(s.username))}?v=${encodeURIComponent(String(s.avatar_url))}` : '',
          creatorRank: (s.creator_rank as CreatorRankId) || 'NEWCOMER',
        },
      };
    }
  } catch {
    // Graceful fallback if database is cold
  }

  return (
    <main style={{ position: 'relative', overflowX: 'clip' }}>
      <PublicNavbar returnTo="/" />
      {/* Infinite Side Visual Animation Rails */}
      <SideIconRail side="left" />
      <SideIconRail side="right" />

      {/* 1. HERO (Tighter vertical spacing) */}
      <section className="hero shell">
        <div className="heroEditorial">
          <p className="eyebrow">THE PLACE FOR WORK YOU&apos;RE PROUD OF</p>
          <h1>Show your skills.<br />In one shot.</h1>
          <p className="lede">Share the work you&apos;re proud of.</p>
          <div className="heroActions">
            <Link className="primary" href={signedIn ? '/upload' : signInPath('/upload', 'Sign in to share a Skillshot')}>
              Share a Skillshot
            </Link>
            <Link className="secondary" href="/community">
              Explore Community
            </Link>
          </div>
        </div>
      </section>

      {/* 2. FRESH FROM THE COMMUNITY (Main Visual Showcase, 3 newest shots) */}
      <section className="feed shell" id="explore">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">FRESH FROM THE COMMUNITY</p>
            <h2>Real work, shared by creators.</h2>
          </div>
          <Link className="textLink" href="/community">See all →</Link>
        </div>
        <Suspense fallback={<HomeFreshSkeleton />}><HomeFresh /></Suspense>
      </section>

      {/* 3. FEATURED CREATOR (Compact, visually focused) */}
      {featuredCreator && (
        <section className="shell homeFeaturedCreatorSection">
          <div className="homeSectionHeader">
            <p className="eyebrow">FEATURED CREATOR</p>
            <h2>Meet the makers behind the work.</h2>
          </div>
          <div className="homeFeaturedCreatorCard">
            {featuredCreator.bannerUrl && (
              <div className="homeCreatorBanner">
                <img src={featuredCreator.bannerUrl} alt="" loading="lazy" />
              </div>
            )}
            <div className="homeCreatorBody">
              <div className="homeCreatorProfileRow">
                <div className="homeCreatorAvatarWrap">
                  {featuredCreator.avatarUrl ? (
                    <img src={featuredCreator.avatarUrl} alt={featuredCreator.displayName} className="homeCreatorAvatar" />
                  ) : (
                    <div className="homeCreatorAvatarFallback">{featuredCreator.displayName.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div className="homeCreatorMeta">
                  <div className="homeCreatorNameBadge">
                    <CreatorUsername
                      name={featuredCreator.displayName}
                      username={featuredCreator.username}
                      role={featuredCreator.role}
                      creatorRank={featuredCreator.creatorRank}
                    />
                  </div>
                  {featuredCreator.bio && <p className="homeCreatorBio">{featuredCreator.bio}</p>}
                </div>
                <div className="homeCreatorAction">
                  <Link href={`/users/${encodeURIComponent(featuredCreator.username)}`} className="button secondary homeCreatorBtn">
                    View Profile →
                  </Link>
                </div>
              </div>

              {featuredCreatorWorks.length > 0 && (
                <div className="homeCreatorWorksRow">
                  {featuredCreatorWorks.map(work => (
                    <Link key={work.id} href={`/shots/${work.id}`} className="homeCreatorWorkThumb">
                      <img
                        src={`/api/images/${work.id}?variant=thumbnail`}
                        alt={work.title}
                        loading="lazy"
                        style={{ aspectRatio: `${work.imageWidth} / ${work.imageHeight}` }}
                      />
                      <span className="homeCreatorWorkTitle">{work.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4. SKILLSHOT OF THE WEEK (One large standout artwork) */}
      {standoutShot && (
        <section className="shell homeStandoutSection">
          <div className="homeSectionHeader">
            <p className="eyebrow">⭐ SKILLSHOT OF THE WEEK</p>
            <h2>Standout craft and execution.</h2>
          </div>
          <article className="homeStandoutCard">
            <Link href={`/shots/${standoutShot.id}`} className="homeStandoutMediaLink">
              <img
                src={`/api/images/${standoutShot.id}`}
                alt={standoutShot.title}
                loading="lazy"
                decoding="async"
                className="homeStandoutImage"
                style={{ aspectRatio: `${standoutShot.imageWidth} / ${standoutShot.imageHeight}` }}
              />
              {standoutShot.imageType === 'image/gif' && <span className="gifBadge">GIF</span>}
            </Link>
            <div className="homeStandoutMeta">
              <div className="homeStandoutAuthorBar">
                <div className="discAvatar">
                  {standoutShot.author.avatarUrl ? (
                    <img src={standoutShot.author.avatarUrl} alt={standoutShot.author.displayName} />
                  ) : (
                    <div className="avatarFallback">{standoutShot.author.displayName.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <CreatorUsername
                  name={standoutShot.author.displayName}
                  username={standoutShot.author.username}
                  role={standoutShot.author.role}
                  creatorRank={standoutShot.author.creatorRank}
                />
              </div>
              <h3 className="homeStandoutTitle">
                <Link href={`/shots/${standoutShot.id}`}>{standoutShot.title}</Link>
              </h3>
              {standoutShot.description && (
                <p className="homeStandoutDescription">{standoutShot.description.slice(0, 180)}</p>
              )}
              <div className="homeStandoutFooter">
                <div className="homeStandoutTags">
                  <span className="standoutCategory">{standoutShot.category}</span>
                  {standoutShot.skills.map(s => (
                    <span key={s} className="standoutSkill">#{s}</span>
                  ))}
                </div>
                <div className="homeStandoutActions">
                  <span className="standoutStats">♡ {standoutShot.reactionCount} · ◌ {standoutShot.commentCount}</span>
                  <Link href={`/shots/${standoutShot.id}`} className="button homeStandoutBtn">
                    View Skillshot →
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </section>
      )}

      {/* 5. EXPLORE BY SKILL (Compact 8-category navigation) */}
      <section className="shell homeSkillsSection">
        <div className="homeSectionHeader">
          <p className="eyebrow">EXPLORE BY SKILL</p>
          <h2>Find work in your discipline.</h2>
        </div>
        <div className="homeSkillsGrid">
          {SKILL_CATEGORIES.map(skill => {
            const href = skill.href || `/search?q=${encodeURIComponent(skill.query || skill.name)}`;
            return (
              <Link key={skill.name} href={href} className="homeSkillCard">
                <span className="homeSkillIcon" aria-hidden="true">{skill.icon}</span>
                <span className="homeSkillName">{skill.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 6. COMMUNITY CTA (Compact, editorial, visually interesting) */}
      <section className="shell homeCtaSection">
        <div className="homeCtaCard">
          <div className="homeCtaContent">
            <p className="eyebrow">JOIN THE COMMUNITY</p>
            <h2>Share what you&apos;re proud of.</h2>
            <p>A focused creative space for makers. No algorithmic games — just craft, feedback, and detail.</p>
          </div>
          <div className="homeCtaAction">
            <Link className="button homeCtaButton" href={signedIn ? '/upload' : signInPath('/upload', 'Sign in to share a Skillshot')}>
              Create a Skillshot
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="shell siteFooter">
        <div className="footerTop">
          <div>
            <Link className="brand" href="/"><span>S</span> Skillshot</Link>
            <p className="footerDescription">An elegant creative community for people who make things.</p>
          </div>
          <nav className="footerNav" aria-label="Footer navigation">
            <Link href="/community">Community</Link>
            <Link href="/search">Search</Link>
            <Link href="/guidelines">Guidelines</Link>
            <Link href="/help">Help</Link>
            <Link href="/about">About</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href={signedIn ? '/profile' : signInPath('/')}>{signedIn ? 'Profile' : 'Sign in'}</Link>
          </nav>
        </div>
        <div className="footerBottom">
          <small>© {new Date().getFullYear()} Skillshot. All rights reserved.</small>
        </div>
      </footer>
    </main>
  );
}
