export type ModerationDecision = { level: 'SAFE'|'BORDERLINE'|'HIGH'; category?: string; providerRef?: string };
const highRisk = /\b(child sexual|kill yourself|nazi extermination|credit card dump)\b/i;
const borderline = /\b(nude|porn|hate|threat|scam|crypto giveaway|buy followers)\b/i;
export async function moderateText(text: string): Promise<ModerationDecision> {
  const endpoint = process.env.MODERATION_API_URL;
  const key = process.env.MODERATION_API_KEY;
  if (endpoint && key) {
    try {
      const response = await fetch(endpoint, { method:'POST', headers:{ authorization:`Bearer ${key}`,'content-type':'application/json' }, body:JSON.stringify({ type:'text', text }), cache:'no-store' });
      if (response.ok) return await response.json() as ModerationDecision;
    } catch { /* local safety rules still run below */ }
  }
  if (highRisk.test(text)) return { level:'HIGH', category:'SAFETY' };
  if (borderline.test(text)) return { level:'BORDERLINE', category:'REVIEW' };
  return { level:'SAFE' };
}
export async function moderateImage(url: string): Promise<ModerationDecision> {
  const endpoint = process.env.MODERATION_API_URL;
  const key = process.env.MODERATION_API_KEY;
  // External image scanning is optional. Existing installations must remain usable
  // when it is not configured; strict deployments can explicitly hold unscanned files.
  if (!endpoint || !key) return process.env.MODERATION_STRICT === 'true'
    ? { level:'BORDERLINE', category:'UNSCANNED' }
    : { level:'SAFE', category:'AUTOMATED_SCAN_NOT_CONFIGURED' };
  try {
    const response = await fetch(endpoint, { method:'POST', headers:{ authorization:`Bearer ${key}`,'content-type':'application/json' }, body:JSON.stringify({ type:'image', url }), cache:'no-store' });
    if (response.ok) return await response.json() as ModerationDecision;
  } catch { /* fall through to the deployment policy below */ }
  return process.env.MODERATION_STRICT === 'true'
    ? { level:'BORDERLINE', category:'PROVIDER_UNAVAILABLE' }
    : { level:'SAFE', category:'AUTOMATED_SCAN_UNAVAILABLE' };
}
