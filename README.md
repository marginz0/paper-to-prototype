# Paper-to-Prototype

> Don't just read the method. Run it.

Paper-to-Prototype turns foundational algorithm papers into grounded,
interactive learning laboratories. Learners change real parameters, advance a
deterministic state machine, and inspect the calculation instead of receiving
another static summary.

Milestone 3 combines three verified, repository-owned laboratories with an
experimental arXiv method-analysis flow. Model output is validated educational
data only. It never becomes application code.

## What works without an API key

All gallery laboratories run locally and in the browser without an OpenAI key:

| Laboratory | Source paper | Route |
| --- | --- | --- |
| k-Means clustering | MacQueen (1967) | [`/lab/kmeans`](http://localhost:3000/lab/kmeans) |
| A* Search | Hart, Nilsson, and Raphael (1968) | [`/lab/astar`](http://localhost:3000/lab/astar) |
| Scaled Dot-Product Attention | Vaswani et al. (2017) | [`/lab/attention`](http://localhost:3000/lab/attention) |

The analyzer at [`/analyze`](http://localhost:3000/analyze) also includes one
hand-reviewed result for **Attention Is All You Need** (`1706.03762`). That
verified path does not call OpenAI, require a key, or consume live-analysis
quota.

Arbitrary arXiv analysis is experimental and requires a server-side
`OPENAI_API_KEY`. It can identify only a faithful match to one of the three
existing method families. It is not universal paper understanding, and an
unsupported result is expected for unrelated methods or substantially different
variants.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You may leave
`OPENAI_API_KEY` empty to use all three labs and the verified Attention analysis.
Set it only when testing live analysis for another arXiv paper.

Environment variables:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-only credential for arbitrary live analysis |
| `OPENAI_MODEL` | Responses API model; defaults to `gpt-5.6` |
| `SITE_URL` | Optional canonical deployment origin for absolute metadata |

Never prefix the key with `NEXT_PUBLIC_` or expose it to browser code.

## Accepted arXiv input

The analyzer accepts a modern arXiv ID, with an optional version suffix, or an
exact HTTPS `arxiv.org` abstract/PDF URL. Examples:

```text
1706.03762
1706.03762v7
https://arxiv.org/abs/1706.03762
https://arxiv.org/abs/1706.03762v7
https://arxiv.org/pdf/1706.03762
https://arxiv.org/pdf/1706.03762.pdf
```

The server does not fetch a caller-selected URL. It validates the identifier and
internally constructs canonical `https://arxiv.org/abs/...` and
`https://arxiv.org/pdf/....pdf` URLs. Other hosts, protocols, credentials,
ports, query strings, fragments, whitespace, and expanded paths are rejected.

## Experimental analysis pipeline

1. A Node.js route accepts only a JSON body shaped as `{ "arxiv": "..." }`, with
   a 1 KB body limit.
2. Input is normalized to a canonical arXiv ID and internally constructed record
   and PDF URLs.
3. `1706.03762` is served from the hand-reviewed verified cache.
4. Other IDs first check the short-lived process-local cache. A fresh cached
   live result can be returned without a current API key.
5. An uncached ID requires `OPENAI_API_KEY`, then passes the best-effort
   process-local live-request limit.
6. The official OpenAI JavaScript SDK sends the internally constructed external
   PDF URL to the Responses API and requests GPT-5.6 structured output.
7. A strict Zod contract rejects unknown or malformed fields. A separate
   consistency validator rejects impossible family, compatibility, confidence,
   and laboratory combinations.
8. Trusted application code may link a supported result to one of three
   statically registered labs. The model never chooses a module or creates UI.

The route returns `Cache-Control: no-store`, sanitizes upstream errors, stores no
paper or user history, and uses no database or authentication. Successful live
results are cached in memory for five minutes. Live calls are limited, best
effort, to five per hashed client in a rolling 15-minute window.

The limiter and live cache are process-local. Serverless cold starts reset them,
and concurrent instances do not share state, so this is demo protection rather
than a durable distributed abuse-control system.

## Code-generation boundary

Codex was used during development to build, review, and test the deterministic
k-Means, A*, and Attention engines and their React learning experiences. There
is no Codex SDK in the deployed application.

At runtime, GPT-5.6 returns data only. The application does not generate,
compile, import, or execute model-produced TSX, JavaScript, HTML, or scripts.
`eval`, `new Function`, runtime Babel, model-controlled imports, and untrusted
iframe execution remain prohibited.

The integration follows the official [Responses API model guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6)
and [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

## Quality checks

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run validate:schema
npm run scan:forbidden
```

With the application already running and a key configured, an explicitly
opt-in live check is available as `npm run smoke:analyze -- <arxiv-id>`. It
prints only a concise status, compatibility, and provenance summary; it is not
part of normal test or build commands.

## Repository map

```text
app/                       App Router pages and the Node analysis route
components/playgrounds/    Trusted interactive laboratory views
components/analysis/       Experimental analyzer UI
data/golden-papers.ts      Typed catalog and source metadata
lib/algorithms/            Deterministic, UI-independent engines
lib/arxiv/                 Strict arXiv input normalization
lib/ai/                    Server-only analysis, validation, cache, and policy
lib/playgrounds/           Closed trusted-engine registry
prompts/                   Deployed prompt contract and retired prompt history
docs/                      Product and architecture documentation
```

See [docs/PRD.md](docs/PRD.md) for requirements and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the complete trust boundary.
