import { describe, expect, it } from "vitest";

import {
  DEFAULT_ANALYSIS_CACHE_TTL_MS,
  DEFAULT_LIVE_ANALYSIS_LIMIT,
  DEFAULT_LIVE_ANALYSIS_WINDOW_MS,
  createAnalysisRequestPolicy,
} from "./analysis-request-policy";

interface TestAnalysis {
  readonly title: string;
}

describe("analysis request rate policy", () => {
  it("allows five live analyses per hashed key in a sliding 15-minute window", () => {
    let currentTime = 1_000;
    const policy = createAnalysisRequestPolicy<TestAnalysis>({
      now: () => currentTime,
    });

    for (let request = 1; request <= DEFAULT_LIVE_ANALYSIS_LIMIT; request += 1) {
      const decision = policy.evaluate({
        hashedClientKey: "sha256:client-a",
        canonicalArxivId: `2401.0000${request}`,
      });

      expect(decision).toMatchObject({
        kind: "allowed",
        limit: DEFAULT_LIVE_ANALYSIS_LIMIT,
        remaining: DEFAULT_LIVE_ANALYSIS_LIMIT - request,
        resetAt: 1_000 + DEFAULT_LIVE_ANALYSIS_WINDOW_MS,
      });
    }

    const limited = policy.evaluate({
      hashedClientKey: "sha256:client-a",
      canonicalArxivId: "2401.00006",
    });
    expect(limited).toEqual({
      kind: "rate-limited",
      limit: 5,
      remaining: 0,
      resetAt: 1_000 + DEFAULT_LIVE_ANALYSIS_WINDOW_MS,
      retryAfterSeconds: 15 * 60,
    });

    currentTime += DEFAULT_LIVE_ANALYSIS_WINDOW_MS - 500;
    expect(
      policy.evaluate({
        hashedClientKey: "sha256:client-a",
        canonicalArxivId: "2401.00007",
      }),
    ).toMatchObject({ kind: "rate-limited", retryAfterSeconds: 1 });

    currentTime += 500;
    expect(
      policy.evaluate({
        hashedClientKey: "sha256:client-a",
        canonicalArxivId: "2401.00008",
      }),
    ).toMatchObject({ kind: "allowed", remaining: 4 });
  });

  it("isolates quotas by opaque hashed client key", () => {
    const policy = createAnalysisRequestPolicy<TestAnalysis>({
      maxLiveRequests: 1,
      now: () => 10_000,
    });

    expect(
      policy.evaluate({
        hashedClientKey: "sha256:first",
        canonicalArxivId: "1706.03762",
      }).kind,
    ).toBe("allowed");
    expect(
      policy.evaluate({
        hashedClientKey: "sha256:first",
        canonicalArxivId: "2207.09238",
      }).kind,
    ).toBe("rate-limited");
    expect(
      policy.evaluate({
        hashedClientKey: "sha256:second",
        canonicalArxivId: "2207.09238",
      }).kind,
    ).toBe("allowed");
  });

  it("does not echo the client key in allowed or limited decisions", () => {
    const privateKey = "sha256:this-must-not-be-returned";
    const policy = createAnalysisRequestPolicy<TestAnalysis>({
      maxLiveRequests: 1,
      now: () => 0,
    });
    const allowed = policy.evaluate({
      hashedClientKey: privateKey,
      canonicalArxivId: "1706.03762",
    });
    const limited = policy.evaluate({
      hashedClientKey: privateKey,
      canonicalArxivId: "2207.09238",
    });

    expect(JSON.stringify(allowed)).not.toContain(privateKey);
    expect(JSON.stringify(limited)).not.toContain(privateKey);
  });
});

describe("successful analysis cache", () => {
  it("serves a fresh success by canonical arXiv ID without consuming quota", () => {
    let currentTime = 2_000;
    const policy = createAnalysisRequestPolicy<TestAnalysis>({
      maxLiveRequests: 1,
      cacheTtlMs: 5_000,
      now: () => currentTime,
    });
    const result = { title: "Attention Is All You Need" };

    expect(
      policy.evaluate({
        hashedClientKey: "sha256:producer",
        canonicalArxivId: " 1706.03762 ",
      }).kind,
    ).toBe("allowed");
    policy.cacheSuccess("1706.03762", result);

    currentTime += 1_500;
    expect(policy.getCached("1706.03762")).toEqual({
      kind: "cached",
      value: result,
      cachedAt: 2_000,
      expiresAt: 7_000,
    });
    expect(
      policy.evaluate({
        hashedClientKey: "sha256:consumer",
        canonicalArxivId: "1706.03762",
      }),
    ).toEqual({
      kind: "cached",
      value: result,
      cachedAt: 2_000,
      expiresAt: 7_000,
    });

    // The cache hit did not consume this client's sole live-analysis slot.
    expect(
      policy.evaluate({
        hashedClientKey: "sha256:consumer",
        canonicalArxivId: "2207.09238",
      }),
    ).toMatchObject({ kind: "allowed", remaining: 0 });
  });

  it("expires cached results at the configured boundary", () => {
    let currentTime = 50;
    const policy = createAnalysisRequestPolicy<TestAnalysis>({
      cacheTtlMs: 100,
      now: () => currentTime,
    });
    policy.cacheSuccess("1706.03762", { title: "cached" });

    currentTime = 149;
    expect(
      policy.evaluate({
        hashedClientKey: "sha256:client",
        canonicalArxivId: "1706.03762",
      }).kind,
    ).toBe("cached");

    currentTime = 150;
    expect(
      policy.evaluate({
        hashedClientKey: "sha256:client",
        canonicalArxivId: "1706.03762",
      }).kind,
    ).toBe("allowed");
  });

  it("clears cached results and request windows without exposing internals", () => {
    const policy = createAnalysisRequestPolicy<TestAnalysis>({
      maxLiveRequests: 1,
      now: () => 1_000,
    });
    policy.cacheSuccess("1706.03762", { title: "cached" });
    policy.evaluate({
      hashedClientKey: "sha256:client",
      canonicalArxivId: "2207.09238",
    });
    policy.clear();

    expect(
      policy.evaluate({
        hashedClientKey: "sha256:client",
        canonicalArxivId: "1706.03762",
      }).kind,
    ).toBe("allowed");
  });
});

describe("analysis policy configuration", () => {
  it("publishes the intended short-cache default", () => {
    expect(DEFAULT_ANALYSIS_CACHE_TTL_MS).toBe(5 * 60 * 1_000);
  });

  it("rejects invalid policy settings, identifiers, and clocks", () => {
    expect(() =>
      createAnalysisRequestPolicy({ maxLiveRequests: 0 }),
    ).toThrow(RangeError);
    expect(() => createAnalysisRequestPolicy({ windowMs: 0 })).toThrow(
      RangeError,
    );
    expect(() => createAnalysisRequestPolicy({ cacheTtlMs: -1 })).toThrow(
      RangeError,
    );

    const policy = createAnalysisRequestPolicy({ now: () => Number.NaN });
    expect(() =>
      policy.evaluate({
        hashedClientKey: "sha256:client",
        canonicalArxivId: "1706.03762",
      }),
    ).toThrow(TypeError);

    const validClockPolicy = createAnalysisRequestPolicy({ now: () => 0 });
    expect(() =>
      validClockPolicy.evaluate({
        hashedClientKey: " ",
        canonicalArxivId: "1706.03762",
      }),
    ).toThrow(TypeError);
    expect(() => validClockPolicy.cacheSuccess("", {})).toThrow(TypeError);
  });
});
