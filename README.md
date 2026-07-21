# Paper to Prototype

> Don't just read the method. Run it.

Paper to Prototype turns the algorithmic method inside a research paper into a
grounded interactive learning lab. Learners manipulate real parameters, advance
the method one step at a time, and inspect the calculation instead of receiving
another static summary.

Technical repository/package slug: `paper-to-prototype`.

## Project links

Repository: [github.com/marginz0/paper-to-prototype](https://github.com/marginz0/paper-to-prototype)

The deployment and video references remain intentionally non-link placeholders
until those deliverables are published:

```text
LIVE_DEMO_URL: [PLACEHOLDER - add verified deployment URL]
YOUTUBE_DEMO_URL: [PLACEHOLDER - add public or unlisted video URL]
```

Submission copy, judge steps, video timing, and the final external-deliverable
checklist are in [docs/SUBMISSION.md](docs/SUBMISSION.md).

## The problem

Research papers communicate methods through dense prose, notation, and static
figures. A reader can understand every sentence and still lack intuition for
how state changes, which parameters matter, or why an algorithm reaches its
result. Most paper tools respond with more text; Paper to Prototype makes the
mechanics runnable.

## Three verified laboratories

All gallery labs run without an OpenAI API key. Their algorithms and
visualizations are trusted repository code, not generated at runtime.

| Laboratory | What the learner can inspect | Route |
| --- | --- | --- |
| k-Means clustering | Assignment, centroid updates, `k`, convergence, and inertia | [`/lab/kmeans`](http://localhost:3000/lab/kmeans) |
| A* Search | Frontier expansion, costs, heuristic weight, editing, and final path | [`/lab/astar`](http://localhost:3000/lab/astar) |
| Scaled Dot-Product Attention | Q/K/V, scores, scaling, temperature, softmax, and output | [`/lab/attention`](http://localhost:3000/lab/attention) |

The Attention lab uses fixed toy vectors and projection matrices. It demonstrates
the mathematics; it is not a trained language model and does not claim learned
linguistic understanding.

## Experimental arXiv analysis

The analyzer at [`/analyze`](http://localhost:3000/analyze) asks whether a
paper's central method faithfully matches one of the three existing labs.

The hand-reviewed **Attention Is All You Need** result for `1706.03762` is the
keyless judge path. It does not call OpenAI, require a key, or consume live
quota. All three labs and this verified analysis remain usable with
`OPENAI_API_KEY` empty.

Arbitrary arXiv analysis is optional and requires a server-only key. GPT-5.6
returns schema-constrained educational data, but a structurally valid live result
can still be factually imperfect. Only the hand-reviewed cached record carries
the **Verified analysis** label. Unrelated methods and substantially different
variants should return unsupported; the analyzer is not universal paper
understanding.

## Local setup

Requirements: Node.js 20 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Environment variables:

| Variable | Required? | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Only for arbitrary live analysis | Server-only OpenAI credential |
| `OPENAI_MODEL` | No | Responses API model; defaults to `gpt-5.6` |
| `SITE_URL` | No | Canonical deployment origin for absolute metadata |

Never prefix the key with `NEXT_PUBLIC_` or expose it to browser code.
`SITE_URL` may be an HTTPS origin or host name. Invalid values are ignored; when
it is empty, production may use the platform-provided Vercel production host,
while the localhost metadata fallback is development-only. The app does not
emit a guessed production deployment URL.

## Accepted arXiv input

The analyzer accepts a modern arXiv ID, optional version suffix, or exact HTTPS
`arxiv.org` abstract/PDF URL:

```text
1706.03762
1706.03762v7
https://arxiv.org/abs/1706.03762
https://arxiv.org/abs/1706.03762v7
https://arxiv.org/pdf/1706.03762
https://arxiv.org/pdf/1706.03762.pdf
```

The server validates the identifier and constructs canonical record and PDF URLs
internally. It rejects alternate domains, protocols, ports, credentials,
queries, fragments, whitespace, malformed IDs, and expanded paths. It never
forwards a caller-selected arbitrary URL.

## Architecture and security

The deterministic lab path is:

```text
typed catalog -> safe slug -> closed static registry
  -> trusted React playground -> pure TypeScript engine -> repository-owned view
```

The optional analysis path is:

```text
1 KB Node API request -> strict arXiv normalization
  -> verified result or process-local cache/policy
  -> official OpenAI SDK Responses API + GPT-5.6 structured output
  -> strict Zod contract -> separate consistency + canonical-ID checks
  -> optional known slug through the closed static registry
```

Security and operational boundaries:

- The PDF and model response are untrusted data.
- Paper-embedded instructions and prompt-like text are explicitly ignored.
- A supported result must match exactly one of standard k-Means, standard A*,
  or scaled dot-product attention.
- Low-confidence, inconsistent, unknown, and unsupported results cannot select a
  lab.
- The API body is capped at 1 KB and responses use `Cache-Control: no-store`.
- Errors are sanitized and never expose provider messages, prompts, keys, stack
  traces, or response bodies.
- The route allows 120 seconds, while one shared abort signal caps the entire
  OpenAI operation—including at most one SDK retry—at 90 seconds.
- Successful live results use a five-minute process-local cache.
- Uncached live calls are limited, best effort, to five per hashed client in a
  rolling 15-minute window.
- The cache and limiter reset on cold starts and are not shared across serverless
  instances; they are demo protection, not durable distributed abuse control.
- There is no database, authentication, saved history, PDF upload, export, or
  code editor.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full trust boundary and
[docs/PRD.md](docs/PRD.md) for product requirements.

## Codex and GPT-5.6 roles

Codex was used during development to inspect the repository, implement and
review the deterministic engines and interfaces, write tests, diagnose issues,
and support verification. There is no Codex SDK in the deployed application.

GPT-5.6 is used only for optional server-side structured paper analysis through
the official OpenAI JavaScript SDK Responses API. It never authors a playground,
algorithm, component, import path, or registry entry.

The application does not generate, compile, import, or execute model-produced
TSX, JavaScript, HTML, or scripts. `eval`, `new Function`, runtime Babel,
model-controlled imports, and untrusted iframe execution are prohibited. There
is no generated-code fallback for an unsupported paper.

## Validation

Run the release gates locally:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run validate:schema
npm run scan:forbidden
```

With the app already running and a valid server key configured, the optional
networked check is:

```bash
npm run smoke:analyze -- 1706.03762v7
```

This README does **not** claim that a keyed live smoke test has succeeded. Record
and publish that result only after an actual run. The deterministic labs and
verified `1706.03762` path do not depend on it.

## Current limitations

- Only three exact method families can produce a supported lab match.
- The analyzer does not reproduce experiments, training, benchmarks, or proofs.
- Live analysis depends on provider/PDF availability and a configured server key.
- Process-local caching and limiting are not shared across deployment instances.
- External deployment and video links remain placeholders until verified.

## Repository map

```text
app/                       App Router pages and Node analysis route
components/playgrounds/    Trusted interactive laboratory views
components/analysis/       Experimental analyzer UI
data/golden-papers.ts      Typed catalog and source metadata
lib/algorithms/            Deterministic UI-independent engines
lib/arxiv/                 Strict arXiv input normalization
lib/ai/                    Server-only analysis, validation, cache, and policy
lib/playgrounds/           Closed trusted-engine registry
prompts/                   Deployed prompt contract and retired prompt history
schema/                    Synchronized structured-output schema artifact
docs/                      Requirements, architecture, and submission draft
```

## License

MIT License. See [LICENSE](LICENSE). Copyright (c) 2026 Joshua.
