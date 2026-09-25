export const MAX_MESSAGE_LEN = 2000;
export const MAX_HISTORY_TURNS = 6;

/**
 * Same-origin check derived from the live request, not a hardcoded domain,
 * so it works unchanged on the *.workers.dev POC host and later on the
 * production zone without a code change.
 */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  // Browsers don't always send Origin on same-origin requests; fall back
  // to Referer. Requests with neither header (e.g. curl/tests) are allowed
  // through here and rely on the rate limiter instead.
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return true;
}

export function clampHistory<T>(history: T[] | undefined): T[] {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_HISTORY_TURNS);
}

export function isValidChatBody(body: unknown): body is {
  message: string;
  history?: unknown[];
  sessionId: string;
  lang?: string;
} {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.message !== "string" || !b.message.trim()) return false;
  if (b.message.length > MAX_MESSAGE_LEN) return false;
  if (typeof b.sessionId !== "string" || !b.sessionId) return false;
  if (b.history !== undefined && !Array.isArray(b.history)) return false;
  return true;
}
