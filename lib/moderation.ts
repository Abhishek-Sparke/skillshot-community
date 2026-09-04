import { moderateWithOpenAI } from './openai-moderation.ts';

export type ModerationDecision = { level: 'SAFE'|'BORDERLINE'|'HIGH'; category?: string; providerRef?: string };
export function scanUnavailable(decision: ModerationDecision): boolean {
  return ['PROVIDER_UNAVAILABLE', 'PROVIDER_NOT_CONFIGURED', 'INVALID_PROVIDER_CONFIGURATION', 'INVALID_PROVIDER_RESPONSE', 'UNSCANNED', 'AUTOMATED_SCAN_NOT_CONFIGURED'].includes(decision.category || '');
}
// Replies are automatically accepted or rejected; scanner failures are not
// evidence of unsafe content and must not create manual approval work.
export function commentModerationError(decision: ModerationDecision): { status: number; error: string } | null {
  if (decision.level === 'SAFE') return null;
  if (scanUnavailable(decision)) {
    if (process.env.MODERATION_STRICT === 'false') return null;
    return { status: 503, error: 'The automatic safety check is temporarily unavailable. Please try again shortly. Your comment has not been posted.' };
  }
  return { status: 422, error: 'This comment may contain NSFW or other unsafe content. Please edit it to follow the community guidelines and try again.' };
}
const highRisk = /\b(child sexual|kill yourself|nazi extermination|credit card dump)\b/i;
const borderline = /\b(nude|porn|hate|threat|scam|crypto giveaway|buy followers)\b/i;
function checkedDecision(value: unknown): ModerationDecision {
  if (!value || typeof value !== 'object' || !('level' in value) || !['SAFE', 'BORDERLINE', 'HIGH'].includes(String(value.level))) {
    return { level: 'BORDERLINE', category: 'INVALID_PROVIDER_RESPONSE' };
  }
  const row = value as Record<string, unknown>;
  return { level: row.level as ModerationDecision['level'], category: typeof row.category === 'string' ? row.category.slice(0, 80) : undefined, providerRef: typeof row.providerRef === 'string' ? row.providerRef.slice(0, 200) : undefined };
}
export async function moderateText(text: string): Promise<ModerationDecision> {
  if (process.env.MODERATION_PROVIDER === 'openai') return moderateWithOpenAI('text', text);
  if (process.env.MODERATION_PROVIDER && process.env.MODERATION_PROVIDER !== 'custom') {
    return { level: 'BORDERLINE', category: 'INVALID_PROVIDER_CONFIGURATION' };
  }
  const endpoint = process.env.MODERATION_API_URL;
  const key = process.env.MODERATION_API_KEY;
  if (endpoint && key) {
    try {
      const response = await fetch(endpoint, { method:'POST', headers:{ authorization:`Bearer ${key}`,'content-type':'application/json' }, body:JSON.stringify({ type:'text', text }), cache:'no-store', signal: AbortSignal.timeout(15_000) });
      if (response.ok) return checkedDecision(await response.json());
    } catch { /* local safety rules still run below */ }
    if (highRisk.test(text)) return { level:'HIGH', category:'SAFETY' };
    return { level:'BORDERLINE', category:'PROVIDER_UNAVAILABLE' };
  }
  if (highRisk.test(text)) return { level:'HIGH', category:'SAFETY' };
  if (borderline.test(text)) return { level:'BORDERLINE', category:'REVIEW' };
  return { level:'SAFE' };
}
export async function moderateImage(url: string): Promise<ModerationDecision> {
  if (process.env.MODERATION_PROVIDER === 'openai') return moderateWithOpenAI('image', url);
  if (process.env.MODERATION_PROVIDER && process.env.MODERATION_PROVIDER !== 'custom') {
    return { level: 'BORDERLINE', category: 'INVALID_PROVIDER_CONFIGURATION' };
  }
  const endpoint = process.env.MODERATION_API_URL;
  const key = process.env.MODERATION_API_KEY;
  if (!endpoint || !key) return process.env.MODERATION_STRICT !== 'false'
    ? { level:'BORDERLINE', category:'UNSCANNED' }
    : { level:'SAFE' };
  try {
    const response = await fetch(endpoint, { method:'POST', headers:{ authorization:`Bearer ${key}`,'content-type':'application/json' }, body:JSON.stringify({ type:'image', url }), cache:'no-store', signal: AbortSignal.timeout(15_000) });
    if (response.ok) return checkedDecision(await response.json());
  } catch { /* fall through */ }
  return { level:'BORDERLINE', category:'PROVIDER_UNAVAILABLE' };
}
