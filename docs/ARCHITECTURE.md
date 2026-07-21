# Paper to Prototype Architecture

## Decision summary

Paper to Prototype has two deliberately separate runtime paths:

1. three deterministic learning laboratories built from repository-owned
   TypeScript and React; and
2. an experimental server-only arXiv analyzer that returns validated educational
   data and may link to one of those existing laboratories.

The model never creates a fourth engine, writes a component, supplies an import
path, or executes code. A closed static registry remains the only bridge from a
supported method family to a playground.

## Verified laboratory path

```text
typed paper catalog
        |
        v
safe /lab/[slug] route
        |
        v
closed trusted registry ---- unknown slug/engine ----> not found
        |
        v
statically imported React playground
        |
        v
pure deterministic algorithm state machine
        |
        v
repository-owned SVG / HTML / CSS visualization
```

All three laboratories run without an API key. No request value becomes an
import path. Algorithm modules do not import React, DOM APIs, model clients, or
browser timers, and the browser stores only ephemeral interaction state.

## Experimental analysis path

```text
/analyze client
        |
        | POST { arxiv } (1 KB maximum)
        v
Node.js /api/analyze route
        |
        v
strict ID/URL normalization
        |
        +---- 1706.03762 ----> hand-reviewed verified result (no key/model call)
        |
        v
five-minute live-result cache check
        |
        v
OPENAI_API_KEY configuration check for cache misses
        |
        v
5 live calls / hashed client / rolling 15 minutes (best effort)
        |
        v
official OpenAI SDK + Responses API + GPT-5.6
        |
        | internally constructed external arxiv.org PDF URL
        v
structured output -> strict Zod parse -> consistency validation -> ID check
        |
        v
sanitized JSON result -> optional known slug -> closed trusted registry
```

The application does not download a caller-selected URL. It accepts only a
modern arXiv ID or exact HTTPS `arxiv.org` abstract/PDF form, preserves an
optional version, and constructs both external URLs from the canonical ID.
Alternate hosts, protocols, ports, credentials, queries, fragments, whitespace,
and extra paths fail before any provider call.

## Repository ownership

```text
app/
  page.tsx                         verified laboratory gallery
  lab/[slug]/page.tsx             static engine dispatch
  analyze/page.tsx                experimental analysis page
  api/analyze/route.ts            Node-only POST entry and client-key hashing
components/
  playgrounds/                    trusted laboratory interactions
  analysis/                       analyzer form and structured result UI
data/golden-papers.ts             closed catalog and paper links
lib/
  algorithms/                     pure deterministic engines
  arxiv/normalize.ts              strict modern-ID/URL normalizer
  playgrounds/registry.ts         slug-to-engine allowlist
  ai/
    analysis-api.ts               1 KB body parser and sanitized HTTP mapping
    analysis-request-policy.ts    process-local limiter and live cache
    analyze-arxiv-paper.ts        server-only Responses integration
    method-analysis.ts            Zod contract and consistency validator
    method-analysis-prompt.ts     deployed prompt-injection/matching rules
    verified-cache.ts             hand-reviewed Attention result
prompts/                           human-readable prompt documentation
schema/method-analysis.schema.json synchronized structural JSON Schema artifact
```

## OpenAI boundary

`analyze-arxiv-paper.ts` is server-only and uses the official OpenAI JavaScript
SDK Responses API. The model defaults to the `gpt-5.6` family alias and is
configurable through the server-only `OPENAI_MODEL` variable. The request:

- supplies a system prompt that treats the paper as untrusted data;
- supplies an internally constructed `https://arxiv.org/pdf/<id>.pdf` external
  file URL;
- requests structured output from the Zod contract;
- uses explicit medium reasoning;
- sets `store: false`;
- gives the hosting function a 120-second maximum duration while one shared
  abort signal caps the full provider operation, including at most one SDK
  retry, at 90 seconds; and
- checks explicit refusals and incomplete output.

The runtime contract in `lib/ai/method-analysis.ts` is authoritative. Its
structural JSON Schema artifact is `schema/method-analysis.schema.json`; the
obsolete extraction schema was removed so there is no competing contract.

Structured output constrains field shape, but structural validity alone does not
make a method match trustworthy. The separate consistency validator enforces:

```text
kmeans_clustering             -> kmeans
astar_search                  -> astar
scaled_dot_product_attention  -> attention
other                         -> unsupported / null slug
low confidence                -> unsupported / null slug
```

Every returned arXiv ID must equal the normalized request ID. Unknown keys,
invalid enum values, inconsistent family/slug pairs, low-confidence matches,
refusals, incomplete responses, and malformed results fail closed. Only trusted
application code interprets a valid known slug through the static registry.

## Prompt-injection boundary

The PDF is untrusted academic content. The system prompt tells the model to
ignore instructions, commands, role changes, and prompt-like content found in
the paper. It also forbids executable code, markup, import paths, and execution
instructions in the response.

Matching is deliberately narrow. A paper is supported only when its central
method is faithfully explained by standard k-Means, standard A*, or scaled
dot-product attention. Shared words such as clustering, graph, search,
transformer, or attention are insufficient. Substantially different variants
remain unsupported unless the existing lab is still a faithful explanation.

These prompt rules reduce risk but do not replace schema parsing, consistency
validation, ID equality, the static registry, or the permanent no-code boundary.

## HTTP and error boundary

The route runs on the Node.js runtime and is force-dynamic. It accepts exactly
one JSON field, `arxiv`, and rejects request bodies larger than 1,024 encoded
bytes whether or not `Content-Length` is supplied.

All success and error responses include:

```text
Cache-Control: no-store, max-age=0
X-Content-Type-Options: nosniff
```

Errors expose stable application codes and safe messages, not raw OpenAI errors,
prompts, stack traces, keys, or provider response bodies. Rate-limited responses
include a whole-second `Retry-After` value.

## Verified and live caching

The hand-reviewed `1706.03762` record is immutable application data. It is
resolved before the OpenAI key and live quota, so it remains available on an
unconfigured deployment.

Successful GPT-5.6 results are cached in memory by canonical arXiv ID for five
minutes. The live quota is checked only after this cache. Uncached live attempts
consume one of five slots per opaque hashed client in a rolling 15-minute
window. The request entry hashes the best available client-address header with a
random process-local HMAC salt; the policy layer never receives a raw address.

Both mechanisms are process-local and best effort:

- cold starts erase state;
- separate serverless instances do not coordinate;
- forwarding-header quality depends on deployment infrastructure; and
- the mechanism is not a durable distributed abuse-control system.

A larger production deployment would need a shared limiter/cache and a trusted
platform-specific client identity policy. Milestone 3 intentionally adds no
database or authentication.

## Permanent execution boundary

Codex built and tested the deterministic engines during repository development.
There is no Codex SDK in the deployed app. Runtime GPT-5.6 output is data only.

The following remain prohibited:

- dynamically generated or executed TSX, JavaScript, HTML, or scripts;
- `eval`, `new Function`, runtime Babel, or equivalent compilation;
- model-controlled imports, modules, registry entries, or iframe content; and
- generated-code fallback for unsupported methods.

## Environment

```text
OPENAI_API_KEY=   server-only; required only for arbitrary live analysis
OPENAI_MODEL=     defaults to gpt-5.6
SITE_URL=         optional canonical deployment origin
```

Gallery labs and the verified Attention analysis do not require a key.
`SITE_URL` accepts a valid HTTP(S) origin or host name and is normalized to its
origin. Invalid values are ignored. In production, a platform-provided Vercel
production host may be used when `SITE_URL` is empty; localhost is only a
development metadata fallback, so the repository never guesses a production
URL.

## Verification gates

Run strict typecheck, focused and full tests, ESLint, production build, schema
validation, and the forbidden-runtime scan. Exercise `/`, every `/lab/[slug]`,
`/analyze`, the verified no-key path, invalid input, missing-key live input, and
an unknown route at desktop and mobile widths. Confirm sanitized HTTP responses,
no browser-console errors, and no model-controlled code path.
