# Paper-to-Prototype Architecture

## Decision summary

Paper-to-Prototype is a Next.js 15 App Router application with three trusted,
repository-owned learning laboratories. React owns interaction and rendering;
pure strict-TypeScript modules own the algorithms. A closed static registry is
the only bridge from paper metadata to a playground component.

Milestone 2 remains local and deterministic. It has no database,
authentication, model call, paper upload, API route, or generated-code path.

## Runtime boundary

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

No request value becomes an import path. The route resolves a slug against a
closed union, then the registry selects one of three components already compiled
with the application.

## Repository ownership

```text
app/
  layout.tsx                       shared document shell
  page.tsx                         verified laboratory gallery
  loading.tsx                      route loading state
  not-found.tsx                    unknown-route state
  lab/[slug]/
    page.tsx                       safe route and static engine dispatch
    loading.tsx                    laboratory loading state
components/
  GalleryCard.tsx                  typed active gallery card
  SiteHeader.tsx / SiteFooter.tsx  shared chrome
  playgrounds/
    KMeansPlayground.tsx           k-Means UI and playback state
    AStarPlayground.tsx            grid UI, editing, and playback state
    AttentionPlayground.tsx        matrix phases and heatmap interaction
data/
  golden-papers.ts                 closed catalog and source links
lib/
  algorithms/
    kmeans.ts                      assignment/update state machine
    astar.ts                       search state machine
    attention.ts                   matrix pipeline and phase state
  playgrounds/registry.ts          slug-to-engine allowlist
prompts/ and schema/                later structured-analysis contracts
```

Algorithm modules do not import React, DOM APIs, or browser timers. Playground
components call the same single-step operation for manual and timed playback.
The browser stores only ephemeral interaction state.

## Deterministic algorithm contracts

### k-Means

A seeded PRNG creates the 2D dataset and deterministic centroids for each
supported `k`. State alternates between assignment and centroid update. Reset or
a `k` change recreates the exact starting state. No algorithm calls
`Math.random()`.

### A* Search

The board is an explicit rectangular value with start, goal, and wall cells.
Each step chooses one open node using stable ordering, closes it, and evaluates
four-directional neighbors. The state exposes open/closed sets, current node,
predecessors, scores, final path, status, and metrics. Manhattan distance is
weighted only in priority:

```text
f(n) = g(n) + w × h(n)
```

Weight 0 is uniform-cost search; weight 1 is standard Manhattan A*; values above
1 are weighted A*. Restart rebuilds search state while retaining the edited
board. Reset Board restores the canonical preset.

### Scaled Dot-Product Attention

Fixed token vectors and projection matrices make the entire pipeline
reproducible:

```text
Q = XWq
K = XWk
V = XWv
scores = QKᵀ
logits = (scores / √dₖ) / temperature
weights = rowSoftmax(logits)
output = weights × V
```

The comparison control may omit the `√dₖ` divisor for education, but the default
and canonical calculation is scaled. Temperature changes only the softmax
logits. The demonstration is deliberately small and untrained; it does not make
claims about learned linguistic relationships.

## Rendering and accessibility

- State is communicated with text, symbols, outlines, or patterns in addition
  to color.
- Every interactive element has a visible label or accessible name and inherits
  the global focus-visible treatment.
- Grid cells are button-like touch targets; the attention heatmap exposes cell
  values and token relationships programmatically.
- Desktop uses a control/sidebar workbench. Mobile stacks controls and
  visualizations without page-level horizontal overflow.
- All nonessential transitions collapse under `prefers-reduced-motion: reduce`.

## Future GPT-5.6 analysis boundary

The experimental arXiv flow belongs to a later milestone:

```text
bounded paper text
        |
        v
GPT-5.6 structured analysis (untrusted JSON)
        |
        v
schema validation + allowlist checks
        |
        v
trusted method-family mapping + bounded configuration
        |
        v
existing algorithm and visualization engine
```

Trusted code—not the model—selects an engine. Unsupported method families fail
closed. The following remain prohibited: generated/executed TSX, `eval`,
`new Function`, runtime Babel, arbitrary script execution, model-controlled
module paths, and untrusted script or iframe content.

## Verification gates

Before review, run strict typecheck, all focused algorithm tests, ESLint, and a
production build. Parse the future extraction schema and scan deployed source
for forbidden runtime patterns. Then exercise `/`, all three laboratory routes,
and an unknown slug at desktop and mobile widths while checking overflow,
accessibility, interaction, and the browser console.
