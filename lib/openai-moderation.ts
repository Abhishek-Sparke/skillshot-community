import type { ModerationDecision } from './moderation.ts';

const categories = ['sexual', 'sexual/minors', 'harassment', 'harassment/threatening', 'hate', 'hate/threatening', 'illicit', 'illicit/violent', 'self-harm', 'self-harm/intent', 'self-harm/instructions', 'violence', 'violence/graphic'];
const severe = new Set(['sexual/minors', 'hate/threatening', 'harassment/threatening', 'illicit/violent', 'self-harm/instructions']);
const held = (category: string): ModerationDecision => ({ level: 'BORDERLINE', category });

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Skillshot review rules, not calibrated probabilities. Ordinary violence
// (including gaming screenshots) is reviewed, not automatically blocked.
export function openAIDecision(value: unknown): ModerationDecision {
  if (!record(value) || typeof value.id !== 'string' || !Array.isArray(value.results) || value.results.length !== 1) return held('INVALID_PROVIDER_RESPONSE');
  const result = value.results[0];
  if (!record(result) || typeof result.flagged !== 'boolean' || !record(result.categories) || !record(result.category_scores)) return held('INVALID_PROVIDER_RESPONSE');
  const flags = result.categories;
  const scores = result.category_scores;
  for (const category of categories) {
    if (typeof flags[category] !== 'boolean' || typeof scores[category] !== 'number' || !Number.isFinite(scores[category]) || Number(scores[category]) < 0 || Number(scores[category]) > 1) return held('INVALID_PROVIDER_RESPONSE');
  }
  const providerRef = value.id.slice(0, 200);
  const blocked = categories.find(category => severe.has(category) && flags[category] === true && Number(scores[category]) >= 0.98);
  if (blocked) return { level: 'HIGH', category: blocked, providerRef };
  const review = Object.keys(flags).find(category => flags[category] === true) ?? categories.find(category => Number(scores[category]) >= 0.5);
  if (result.flagged || review) return { level: 'BORDERLINE', category: review?.slice(0, 80) || 'REVIEW', providerRef };
  return { level: 'SAFE', providerRef };
}

export async function moderateWithOpenAI(kind: 'text' | 'image', content: string): Promise<ModerationDecision> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return held('PROVIDER_NOT_CONFIGURED');
  if (kind === 'image' && !/^data:image\/(png|jpeg|webp);base64,/.test(content)) return held('INVALID_IMAGE_INPUT');
  const input = kind === 'text' ? content : [{ type: 'image_url', image_url: { url: content } }];
  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return held('PROVIDER_UNAVAILABLE');
    return openAIDecision(await response.json());
  } catch {
    // Do not log content, credentials, scores, or raw provider errors.
    return held('PROVIDER_UNAVAILABLE');
  }
}
