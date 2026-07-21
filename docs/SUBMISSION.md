# Paper to Prototype - Submission Draft

Repository/package slug: `paper-to-prototype`

The repository and production deployment references are final. The video
reference remains a plain-text placeholder until that deliverable is real and
publicly reachable:

```text
LIVE_DEMO_URL: https://paper-to-prototype.vercel.app
YOUTUBE_DEMO_URL: [PLACEHOLDER - add public or unlisted video URL]
PUBLIC_REPOSITORY_URL: https://github.com/marginz0/paper-to-prototype
```

## 1. One-sentence pitch

Paper to Prototype turns the algorithmic method inside a research paper into a
grounded interactive lab, so learners can manipulate the real mechanics instead
of reading another static summary.

## 2. Short project description

Paper to Prototype is an education product for learning foundational algorithms
by running them. The release candidate includes verified labs for k-Means, A*
Search, and Scaled Dot-Product Attention, plus an experimental arXiv analyzer
that can match a paper's central method to one of those existing labs.

All three labs and the hand-reviewed `1706.03762` Attention analysis work without
an API key. Arbitrary paper analysis is an optional server-side GPT-5.6 path.

## 3. Longer "What it does"

Research papers often communicate a method through dense prose, equations, and
static figures. Paper to Prototype makes the transitions visible:

- **k-Means:** change `k`, then step or play through point assignment and
  centroid updates while watching inertia change.
- **A* Search:** edit a grid, tune heuristic weight, and inspect the frontier,
  visited nodes, path costs, and final route one expansion at a time.
- **Scaled Dot-Product Attention:** follow fixed toy vectors through Q/K/V
  projection, dot products, square-root scaling, temperature-controlled softmax,
  and weighted value output. The example is explicitly untrained.

The experimental analyzer accepts a narrowly validated modern arXiv ID or exact
`arxiv.org` URL. It returns paper-grounded educational data, paraphrased
evidence, limitations, confidence, and either one faithful lab match or an
honest unsupported result. It does not promise universal paper understanding.

## 4. How it works

### Trusted laboratory path

```text
typed paper catalog
  -> safe lab slug
  -> closed static registry
  -> repository-owned React playground
  -> pure deterministic TypeScript algorithm
  -> SVG / HTML / CSS visualization
```

### Experimental analysis path

```text
1 KB POST body
  -> strict arXiv normalization
  -> verified 1706.03762 record, or process-local cache/policy
  -> official OpenAI SDK Responses API with GPT-5.6
  -> strict Zod structured output
  -> separate cross-field consistency and canonical-ID checks
  -> optional known slug through the same closed registry
```

The server constructs the canonical external arXiv PDF URL itself. It rejects
alternate domains, arbitrary paths, credentials, ports, queries, fragments,
whitespace, and malformed IDs before any provider call.

The API route uses the Node.js runtime, a 1 KB request-body cap, `no-store`
responses, sanitized errors, a five-minute process-local live cache, and a
best-effort five-live-requests-per-hashed-client rolling 15-minute limit. There
is no database, authentication, saved history, or PDF upload.

## 5. How Codex and GPT-5.6 were used

### Codex

Codex was the engineering collaborator used to inspect the source material,
shape the architecture, implement the deterministic engines and interfaces,
write focused tests, investigate failures, and run repository/browser
verification. The resulting labs are trusted application code checked into the
repository. There is no Codex SDK in the deployed product.

### GPT-5.6

GPT-5.6 is used only in the optional server-side arXiv analysis flow. The
official OpenAI JavaScript SDK Responses API supplies an internally constructed
arXiv PDF URL and requests a strict structured result. GPT-5.6 describes one
central method and assesses whether it faithfully matches one of three known
families.

GPT-5.6 returns data only. It never authors TSX, JavaScript, an algorithm,
visualization, import path, registry entry, or executable configuration. The
application rejects unknown, inconsistent, unsupported, and low-confidence
matches before a trusted static lab link is exposed.

## 6. Major technical decisions

- Next.js 15 App Router, React, strict TypeScript, and Tailwind CSS.
- Pure deterministic algorithm modules separated from React UI.
- Seeded data or fixed vectors; no `Math.random()` in algorithm engines.
- A closed typed registry for exactly three compiled playgrounds.
- Repository-owned SVG/HTML/CSS visualization instead of generated UI.
- No database or authentication for the release candidate.
- A no-key verified path for `1706.03762`, kept ahead of API-key and quota checks.
- Official OpenAI SDK Responses API with `gpt-5.6`, structured output, and
  `store: false` for optional arbitrary analysis.
- Strict Zod field validation plus a separate semantic consistency validator.
- Canonical arXiv ID reconstruction to prevent arbitrary-URL forwarding.
- Stable sanitized API errors and best-effort process-local demo protections.
- A permanent ban on generated/executed code, `eval`, `new Function`, runtime
  Babel, model-controlled imports, and untrusted iframe content.

## 7. Challenges and lessons

1. **A phase-by-phase lab needs a real state machine.** Keeping the algorithms
   pure made manual stepping, playback, reset, and tests share the same path.
2. **Determinism is a teaching feature.** Reproducible data and exact resets let
   learners compare parameter changes rather than chase incidental randomness.
3. **Visualization needs an honesty boundary.** The Attention lab demonstrates
   the mathematics with fixed toy vectors; it does not imply learned language
   understanding.
4. **Structured output still needs semantic checks.** A schema can validate
   fields while allowing a contradictory family/slug combination, so the app
   applies a separate consistency validator.
5. **A safe URL flow should construct, not trust.** The server reduces accepted
   arXiv input to a canonical ID and builds the PDF URL internally.
6. **Unsupported is a valid result.** Restricting matches to three faithful
   engines is more educational than forcing every paper into a flashy demo.
7. **Serverless memory is only best effort.** The in-process limiter and cache
   are suitable for a competition demo, not durable distributed abuse control.

## 8. Judge testing instructions

### Hosted path

Use the verified production site at `https://paper-to-prototype.vercel.app`.

### Local path

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. An OpenAI API key is not required for the core
judge path.

Suggested review sequence:

1. On `/`, confirm all three laboratory cards are active.
2. Open `/lab/kmeans`; change `k`, Step, Play/Pause, speed, and Reset.
3. Open `/lab/astar`; edit a wall, vary heuristic weight, and Step/Play to a
   terminal path or no-path state.
4. Open `/lab/attention`; use Previous/Next, temperature, scaled/unscaled mode,
   and heatmap cell selection. Confirm the toy/untrained disclaimer.
5. Open `/analyze`, submit `1706.03762`, and confirm the result is marked as a
   hand-reviewed verified analysis with an Attention lab link. This path should
   work with an empty `OPENAI_API_KEY`.
6. Submit malformed or non-arXiv input and confirm a safe validation message.
7. Optionally, configure a server-only key and submit another modern arXiv ID to
   exercise live GPT-5.6 analysis. A keyed live smoke result is **not claimed in
   this draft** and is not required to review the deterministic labs or verified
   sample.

Repository checks:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run validate:schema
npm run scan:forbidden
```

The optional networked smoke command is
`npm run smoke:analyze -- 1706.03762v7` with the application running and a valid
server key. The versioned ID deliberately bypasses the exact unversioned
verified cache. Record its real outcome before making any submission claim.

## 9. Education-category justification

Paper to Prototype is primarily a learning instrument, not a paper summarizer.
Each lab turns an abstract procedure into a manipulable sequence with visible
state, real metrics, parameter controls, contextual explanation, and exact
reset. Learners can form and test hypotheses: how `k` affects inertia, how a
heuristic changes A* expansion, or how scaling and temperature change attention
concentration.

The analyzer strengthens that educational loop by asking a narrow question:
"Does this paper's central method faithfully match something the learner can
run here?" It prefers an honest non-match over misleading interactivity.

## 10. Technology tags

`Education` `Research` `Algorithms` `Interactive Visualization` `Next.js 15`
`React` `TypeScript` `Tailwind CSS` `SVG` `OpenAI Responses API` `GPT-5.6`
`Structured Outputs` `Zod` `Vitest` `arXiv` `Codex`

## 11. Provisional video sequence (2:35 maximum)

| Time | Visual | Narration goal |
| --- | --- | --- |
| 0:00-0:10 | Paper page to interactive lab cut | State the problem and tagline |
| 0:10-0:25 | Landing gallery | Show the complete three-lab product |
| 0:25-0:50 | k-Means assignment/update | Demonstrate real parameters and deterministic stepping |
| 0:50-1:15 | A* frontier and final path | Show heuristic tradeoffs and visible search state |
| 1:15-1:40 | Attention heatmap and temperature | Derive weights phase by phase; call out fixed toy vectors |
| 1:40-2:05 | `/analyze` with `1706.03762` | Show the keyless verified analysis and trusted lab match |
| 2:05-2:23 | Architecture/security graphic or code | Explain GPT-5.6 data-only output and the static registry |
| 2:23-2:35 | Three labs plus tagline | Close with educational impact and review invitation |

Keep the recorded video under 2 minutes 40 seconds. Do not spend demo time on
an unverified network call; use the deterministic keyless judge path unless a
live keyed analysis has been tested immediately before recording.

## 12. Final submission checklist

### External deliverables

- [ ] Deploy the release candidate and verify every judge path in production.
- [x] Record `https://paper-to-prototype.vercel.app` as the public deployment URL.
- [ ] Confirm the public repository is reachable at `https://github.com/marginz0/paper-to-prototype`.
- [ ] Add the verified live-demo URL to the README project-links block.
- [ ] Record a video under 2:40 and upload it as public or unlisted on YouTube.
- [ ] Replace `YOUTUBE_DEMO_URL` here and in the README project-links block.
- [ ] Confirm the video does not claim an untested keyed smoke result.
- [ ] Complete a `/feedback` session and record its session ID below.
- [ ] Create/finalize the Devpost entry with the pitch, description, tags,
  repository, deployment, video, and screenshots.
- [ ] Submit the Devpost entry before the competition deadline.

```text
FEEDBACK_SESSION_ID: [PLACEHOLDER - add completed /feedback session ID]
DEVPOST_SUBMISSION_URL: [PLACEHOLDER - add final Devpost URL]
KEYED_LIVE_SMOKE_RESULT: [NOT CLAIMED - record only after a real run]
```

### Release-candidate evidence

- [ ] Record the final commit SHA used for deployment.
- [ ] Record exact typecheck, test, lint, build, schema, and forbidden-scan results.
- [ ] Check desktop and approximately 390 px mobile layouts in production.
- [ ] Confirm browser consoles are clear on the gallery, three labs, and analyzer.
- [ ] Re-test the no-key `1706.03762` verified path on the deployed instance.
- [ ] Confirm `OPENAI_API_KEY` is server-only and absent from public logs/bundles.
- [ ] Confirm the README and submission draft contain no remaining placeholders
  before final submission.
