'use client';

import type { LevelProgress, RankProgress } from '../../lib/creator-rank';

export default function CreatorProgress({ rankProgress, levelProgress, onOpen }: { rankProgress: RankProgress; levelProgress?: LevelProgress; onOpen: () => void }) {
  const currentXp = rankProgress.xp;
  const targetXp = rankProgress.nextTierXp;
  const isLegend = rankProgress.rank.id === 'LEGEND' || !rankProgress.nextRankTitle;
  const percent = isLegend ? 100 : (targetXp ? Math.min(100, Math.max(0, Math.floor((currentXp / targetXp) * 100))) : 100);
  const remainingXp = targetXp ? Math.max(0, targetXp - currentXp) : 0;
  return <section className="profileProgress" aria-label="Creator level and XP progress">
    <div className="profileProgressTop">
      <span className="profileProgressRank"><small>Creator rank</small><b>{rankProgress.rank.label}</b></span>
      <strong>Level {levelProgress?.level ?? 1}</strong>
    </div>
    <div className="profileProgressNumbers">
      <span>{isLegend ? `${currentXp.toLocaleString()} XP` : `${currentXp.toLocaleString()} / ${targetXp ? targetXp.toLocaleString() : '50,000+'} XP`}</span>
      <b>{isLegend ? 'MAX' : `${percent}%`}</b>
    </div>
    <div className="profileProgressTrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }}/></div>
    <div className="profileProgressNext">
      <span>Next: <b>{isLegend ? 'MAX' : (rankProgress.nextRankTitle ?? 'MAX')}</b>{!isLegend && targetXp ? ` · ${remainingXp.toLocaleString()} XP` : ''}</span>
      <button type="button" onClick={onOpen}>Rank details</button>
    </div>
  </section>;
}
