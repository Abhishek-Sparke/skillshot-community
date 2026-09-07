export const XP_REWARDS = Object.freeze({
  PROFILE_COMPLETE: configured('XP_PROFILE_COMPLETE', 50), SKILLSHOT_PUBLISHED: configured('XP_SKILLSHOT_PUBLISHED', 100),
  LIKE_RECEIVED: configured('XP_LIKE_RECEIVED', 5), SAVE_RECEIVED: configured('XP_SAVE_RECEIVED', 10),
  COMMENT_RECEIVED: configured('XP_COMMENT_RECEIVED', 10), COMMENT_CREATED: configured('XP_COMMENT_CREATED', 5),
  DISCUSSION_CREATED: configured('XP_DISCUSSION_CREATED', 15), DISCUSSION_REPLY: configured('XP_DISCUSSION_REPLY', 5),
  HELPFUL_CONTRIBUTION: configured('XP_HELPFUL_CONTRIBUTION', 25), FEATURED_SKILLSHOT: configured('XP_FEATURED_SKILLSHOT', 250),
  SKILLSHOT_OF_WEEK: configured('XP_SKILLSHOT_OF_WEEK', 500),
});
function configured(name:string,fallback:number){const value=Number(process.env[name]);return Number.isFinite(value)&&value>=0?Math.floor(value):fallback;}
export function normalizeCommentForXp(value:string){return value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();}
export function isMeaningfulComment(value:string){const normalized=normalizeCommentForXp(value),compact=normalized.replace(/\s/g,'');if([...compact].length<5)return false;if(!/[\p{L}\p{N}]/u.test(compact))return false;const chars=[...compact].filter(char=>/[\p{L}\p{N}]/u.test(char));return new Set(chars).size>=2&&!/(.)\1{4,}/u.test(compact);}
