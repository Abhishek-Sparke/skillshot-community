'use client';

import CreatorRankBadge from './creator-rank-badge';
import { CREATOR_RANKS, type CreatorRankId, type LevelProgress, type RankProgress } from '../../lib/creator-rank';

const rankOrder: CreatorRankId[] = ['NEWCOMER', 'CREATOR', 'RISING_CREATOR', 'SKILLED_CREATOR', 'ELITE_CREATOR', 'MASTER_CREATOR', 'LEGEND'];

export default function CreatorRankCard({ rank, rankProgress, levelProgress, onClose }: {
  rank: CreatorRankId;
  rankProgress: RankProgress;
  levelProgress: LevelProgress;
  onClose: () => void;
}) {
  const currentIndex = rankOrder.indexOf(rank);
  return <div className="rankCardOverlay" role="dialog" aria-modal="true" aria-label={`${rankProgress.rank.label} creator rank`} onClick={onClose}>
    <section className="rankCard" onClick={event => event.stopPropagation()}>
      <button className="rankCardClose" type="button" onClick={onClose} aria-label="Close rank details">×</button>
      <p className="eyebrow">CREATOR PROGRESSION</p>
      <CreatorRankBadge rank={rank} size="lg" className="rankCardHeroIcon" />
      <h2>{rankProgress.rank.label}</h2>
      <strong className="rankCardLevel">Level {levelProgress.level}</strong>
      <div className="rankCardNumbers"><span>{levelProgress.xp.toLocaleString()} / {levelProgress.nextLevelXp.toLocaleString()} XP</span><b>{levelProgress.progressPercent}%</b></div>
      <div className="rankCardTrack" aria-label={`${levelProgress.progressPercent}% toward level ${levelProgress.level + 1}`}><span style={{ width: `${levelProgress.progressPercent}%` }}/></div>
      <div className="rankCardNext">
        <span>Next rank</span>
        <b>{rankProgress.rank.id === 'LEGEND' || !rankProgress.nextRankTitle ? 'MAX' : rankProgress.nextRankTitle}</b>
        {!(rankProgress.rank.id === 'LEGEND' || !rankProgress.nextRankTitle) && rankProgress.nextTierXp && <small>{Math.max(0, rankProgress.nextTierXp - rankProgress.xp).toLocaleString()} XP remaining</small>}
      </div>
      <div className="rankTimeline" aria-label="Creator rank progression">
        {rankOrder.map((rankId, index) => <div key={rankId} className={index < currentIndex ? 'unlocked' : index === currentIndex ? 'current' : 'locked'}>
          <CreatorRankBadge rank={rankId} size="sm" />
          <small>{CREATOR_RANKS[rankId].label}</small>
        </div>)}
      </div>
    </section>
  </div>;
}
