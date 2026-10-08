/**
 * Client adapter for the Cyberbully AI text moderation microservice.
 *
 * Communicates with the FastAPI Cyberbully moderation service, normalizes responses,
 * applies configurable review thresholds, and degrades gracefully on timeouts or service errors.
 */

export type CyberbullyResult = {
  provider: 'cyberbully';
  flagged: boolean;
  category: string | null;
  score: number;
};

export type CyberbullyEvaluation = {
  action: 'ALLOW' | 'REVIEW' | 'HIGH_CONFIDENCE';
  severity: 'BORDERLINE' | 'HIGH';
  category: string;
};

/**
 * Validates whether a response from the Cyberbully service matches the expected schema.
 */
function isValidCyberbullyResponse(data: unknown): data is { label: string; score: number; category: string | null; flagged: boolean } {
  if (!data || typeof data !== 'object') return false;
  const item = data as Record<string, unknown>;
  if (typeof item.label !== 'string') return false;
  if (typeof item.score !== 'number' || !Number.isFinite(item.score) || item.score < 0 || item.score > 1) return false;
  if (typeof item.flagged !== 'boolean') return false;
  if (item.category !== null && typeof item.category !== 'string') return false;
  return true;
}

/**
 * Classifies text using the Cyberbully service.
 * Degrades gracefully: returns null on network errors, timeouts, or unconfigured service.
 * NEVER throws or crashes the host application.
 */
export async function moderateWithCyberbully(text: string): Promise<CyberbullyResult | null> {
  const serviceUrl = process.env.CYBERBULLY_SERVICE_URL?.trim();
  if (!serviceUrl) {
    // Service not enabled or configured; proceed with normal pipeline
    return null;
  }

  const cleanText = text.trim();
  if (!cleanText) {
    return null;
  }

  // Pre-flight length limit (Skillshot comments are 1000 chars)
  const boundedText = cleanText.slice(0, 1000);

  const timeoutMs = Number(process.env.CYBERBULLY_TIMEOUT_MS) || 5000;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = process.env.CYBERBULLY_SERVICE_TOKEN?.trim();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = new URL('/moderate', serviceUrl).toString();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: boundedText }),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.error(`[Cyberbully] Service returned HTTP ${response.status} (${response.statusText})`);
      return null;
    }

    const json = await response.json();
    if (!isValidCyberbullyResponse(json)) {
      console.error('[Cyberbully] Invalid response schema received from service');
      return null;
    }

    return {
      provider: 'cyberbully',
      flagged: json.flagged,
      category: json.category,
      score: json.score,
    };
  } catch (err) {
    // Graceful degradation: Log error safely without leaking sensitive information
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Cyberbully] Connection failed or timed out (${msg}). Degrading to standard workflow.`);
    return null;
  }
}

/**
 * Evaluates a Cyberbully result against server-side configurable thresholds.
 *
 * Initial engineering thresholds:
 * - score < 0.50 => ALLOW
 * - 0.50 <= score < 0.90 => REVIEW (severity: BORDERLINE)
 * - score >= 0.90 => HIGH_CONFIDENCE (severity: HIGH)
 */
export function evaluateCyberbullyScore(result: CyberbullyResult): CyberbullyEvaluation {
  const reviewThreshold = Number(process.env.CYBERBULLY_REVIEW_THRESHOLD || '0.50');
  const highConfidenceThreshold = Number(process.env.CYBERBULLY_HIGH_CONFIDENCE_THRESHOLD || '0.90');

  const category = result.category || 'cyberbullying';

  if (result.score >= highConfidenceThreshold) {
    return {
      action: 'HIGH_CONFIDENCE',
      severity: 'HIGH',
      category,
    };
  }

  if (result.score >= reviewThreshold || result.flagged) {
    return {
      action: 'REVIEW',
      severity: 'BORDERLINE',
      category,
    };
  }

  return {
    action: 'ALLOW',
    severity: 'BORDERLINE',
    category,
  };
}
