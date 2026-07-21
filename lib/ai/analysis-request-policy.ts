export const DEFAULT_LIVE_ANALYSIS_LIMIT = 5;
export const DEFAULT_LIVE_ANALYSIS_WINDOW_MS = 15 * 60 * 1_000;
export const DEFAULT_ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1_000;

export interface AnalysisRequestPolicyOptions {
  readonly maxLiveRequests?: number;
  readonly windowMs?: number;
  readonly cacheTtlMs?: number;
  readonly now?: () => number;
}

export interface AnalysisPolicyInput {
  /** An opaque, already-hashed client identifier. Never pass a raw IP. */
  readonly hashedClientKey: string;
  /** The normalized arXiv identifier used by the fetch/analysis layer. */
  readonly canonicalArxivId: string;
}

export interface AllowedAnalysisDecision {
  readonly kind: "allowed";
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
}

export interface RateLimitedAnalysisDecision {
  readonly kind: "rate-limited";
  readonly limit: number;
  readonly remaining: 0;
  readonly resetAt: number;
  /** Whole seconds suitable for an HTTP Retry-After header. */
  readonly retryAfterSeconds: number;
}

export interface CachedAnalysisDecision<Result> {
  readonly kind: "cached";
  readonly value: Result;
  readonly cachedAt: number;
  readonly expiresAt: number;
}

export type AnalysisPolicyDecision<Result> =
  | AllowedAnalysisDecision
  | RateLimitedAnalysisDecision
  | CachedAnalysisDecision<Result>;

export interface AnalysisRequestPolicy<Result> {
  /** Returns a fresh cached result without consuming a live-analysis slot. */
  getCached(canonicalArxivId: string): CachedAnalysisDecision<Result> | null;
  /**
   * Returns a fresh cached result before consulting quota. Otherwise, this
   * atomically consumes one live-analysis slot or returns a retry time.
   */
  evaluate(input: AnalysisPolicyInput): AnalysisPolicyDecision<Result>;
  /** Call only after a live analysis completes successfully. */
  cacheSuccess(canonicalArxivId: string, value: Result): void;
  /** Clears process-local state; useful for lifecycle teardown and tests. */
  clear(): void;
}

interface CacheEntry<Result> {
  readonly value: Result;
  readonly cachedAt: number;
  readonly expiresAt: number;
}

/**
 * Creates a best-effort, process-local policy for the experimental live-analysis
 * path. It intentionally has no framework, network, persistence, or logging
 * dependency. Multi-instance deployments still need an external shared limiter.
 */
export function createAnalysisRequestPolicy<Result>(
  options: AnalysisRequestPolicyOptions = {},
): AnalysisRequestPolicy<Result> {
  const maxLiveRequests =
    options.maxLiveRequests ?? DEFAULT_LIVE_ANALYSIS_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_LIVE_ANALYSIS_WINDOW_MS;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_ANALYSIS_CACHE_TTL_MS;
  const now = options.now ?? Date.now;

  assertPositiveInteger(maxLiveRequests, "maxLiveRequests");
  assertPositiveDuration(windowMs, "windowMs");
  assertPositiveDuration(cacheTtlMs, "cacheTtlMs");

  // Keys are opaque hashes supplied by trusted application code. Neither raw
  // addresses nor request metadata enter this module or its returned decisions.
  const requestTimesByHashedClient = new Map<string, number[]>();
  const successfulResultsByArxivId = new Map<string, CacheEntry<Result>>();

  function evaluate({
    hashedClientKey,
    canonicalArxivId,
  }: AnalysisPolicyInput): AnalysisPolicyDecision<Result> {
    const clientKey = normalizeNonEmpty(hashedClientKey, "hashedClientKey");
    const arxivId = normalizeNonEmpty(canonicalArxivId, "canonicalArxivId");
    const currentTime = readClock(now);
    pruneExpired(currentTime);

    const cached = readCached(arxivId);
    if (cached) {
      return {
        kind: "cached",
        value: cached.value,
        cachedAt: cached.cachedAt,
        expiresAt: cached.expiresAt,
      };
    }

    const requestTimes = requestTimesByHashedClient.get(clientKey) ?? [];
    if (requestTimes.length >= maxLiveRequests) {
      const resetAt = requestTimes[0] + windowMs;
      return {
        kind: "rate-limited",
        limit: maxLiveRequests,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((resetAt - currentTime) / 1_000),
        ),
      };
    }

    const updatedRequestTimes = [...requestTimes, currentTime];
    requestTimesByHashedClient.set(clientKey, updatedRequestTimes);

    return {
      kind: "allowed",
      limit: maxLiveRequests,
      remaining: maxLiveRequests - updatedRequestTimes.length,
      resetAt: updatedRequestTimes[0] + windowMs,
    };
  }

  function cacheSuccess(canonicalArxivId: string, value: Result): void {
    const arxivId = normalizeNonEmpty(canonicalArxivId, "canonicalArxivId");
    const currentTime = readClock(now);
    pruneExpired(currentTime);
    successfulResultsByArxivId.set(arxivId, {
      value,
      cachedAt: currentTime,
      expiresAt: currentTime + cacheTtlMs,
    });
  }

  function getCached(
    canonicalArxivId: string,
  ): CachedAnalysisDecision<Result> | null {
    const arxivId = normalizeNonEmpty(canonicalArxivId, "canonicalArxivId");
    const currentTime = readClock(now);
    pruneExpired(currentTime);
    const cached = readCached(arxivId);
    return cached
      ? {
          kind: "cached",
          value: cached.value,
          cachedAt: cached.cachedAt,
          expiresAt: cached.expiresAt,
        }
      : null;
  }

  function readCached(arxivId: string): CacheEntry<Result> | undefined {
    return successfulResultsByArxivId.get(arxivId);
  }

  function pruneExpired(currentTime: number): void {
    const cutoff = currentTime - windowMs;

    for (const [clientKey, requestTimes] of requestTimesByHashedClient) {
      const activeRequestTimes = requestTimes.filter(
        (requestTime) => requestTime > cutoff,
      );
      if (activeRequestTimes.length === 0) {
        requestTimesByHashedClient.delete(clientKey);
      } else if (activeRequestTimes.length !== requestTimes.length) {
        requestTimesByHashedClient.set(clientKey, activeRequestTimes);
      }
    }

    for (const [arxivId, cached] of successfulResultsByArxivId) {
      if (cached.expiresAt <= currentTime) {
        successfulResultsByArxivId.delete(arxivId);
      }
    }
  }

  return {
    getCached,
    evaluate,
    cacheSuccess,
    clear() {
      requestTimesByHashedClient.clear();
      successfulResultsByArxivId.clear();
    },
  };
}

function normalizeNonEmpty(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function readClock(now: () => number): number {
  const currentTime = now();
  if (!Number.isFinite(currentTime)) {
    throw new TypeError("now must return a finite millisecond timestamp.");
  }
  return currentTime;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
}

function assertPositiveDuration(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive duration in milliseconds.`);
  }
}
