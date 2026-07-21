# Paper-to-Prototype Architecture

## Decision summary

Paper-to-Prototype is a Next.js 15 App Router application with trusted,
repository-owned laboratory engines. React renders the experience; pure
TypeScript modules perform the algorithms. No generated code crosses the
runtime boundary.

Milestone 1 is entirely local and deterministic. It has no database,
authentication, model call, paper upload, or server API requirement.

## System boundaries

```text
Typed lab catalog
       |
       v
Next.js route ----> trusted playground component ----> SVG/Recharts view
                              |
                              v
                    pure deterministic algorithm
```

The route resolves a safe slug through the typed laboratory catalog. A trusted
registry selects a component already compiled with the application. The
component owns presentation and playback state; it calls a pure algorithm
module for state transitions. SVG or Recharts receives ordinary serializable
data.

## Milestone 1 structure

```text
app/
  layout.tsx                 Shared document layout
  page.tsx                   Laboratory gallery
  loading.tsx                App loading state
  not-found.tsx              Global unknown-route state
  lab/[slug]/
    page.tsx                 Safe laboratory route resolution
    loading.tsx              Laboratory loading state
components/
  header.tsx                 Reusable product header
  gallery-card.tsx           Available/planned laboratory card
  playgrounds/
    kmeans-playground.tsx    k-Means controls, playback, and SVG
data/
  golden-papers.ts           Typed three-laboratory catalog
lib/
  algorithms/
    kmeans.ts                Seeded data and pure state transitions
prompts/                     Future structured-analysis material only
schema/                      Future model-output schema
```

Exact filenames may vary slightly during implementation, but these ownership
boundaries should not.

## k-Means state model

The k-Means engine is independent from React. Its public operations cover:

- seeded creation of a fixed two-dimensional point set;
- deterministic centroid initialization for each supported `k`;
- assignment of each point to its nearest centroid;
- recomputation of each centroid from its assigned points; and
- inertia calculation as the sum of squared distances from points to their
  assigned centroids.

The UI advances a two-phase state machine:

```text
assignment --Step--> centroid update --Step--> assignment
```

An iteration is complete after the centroid-update phase. Play invokes the same
single-step transition on a timer; it must not maintain a second algorithm path.
Changing `k` or pressing Reset reconstructs state from the same seed and
deterministic initializer. `Math.random()` is not allowed in algorithm code.

The browser owns ephemeral playback state only. No state is persisted.

## Rendering and accessibility

- Laboratory views use repository-owned SVG or Recharts components.
- Plot marks, centroids, and current phase use more than color alone where
  practical.
- Every control has a programmatic label and visible focus treatment.
- Motion is restrained and must respect reduced-motion preferences where
  possible.
- Responsive layout supports an approximately 390 px viewport without hiding
  required controls or metrics.

## Trusted registry

`data/golden-papers.ts` is the catalog and status source of truth. Slugs are a
closed union: `kmeans`, `astar`, and `attention`. Only `kmeans` is `available`
in Milestone 1. A route must not infer an import path from a URL or dynamically
execute a module named by input.

When additional laboratories are implemented, a trusted registry will map a
known slug to a statically imported playground. Catalog status changes only
after that playground is verified.

## Future GPT-5.6 analysis boundary

The experimental arXiv flow belongs to a later milestone. Its intended data
flow is:

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

Model output is never treated as source code. Trusted application code—not the
model—selects the visualization engine. Unsupported method families fail closed
with an explanatory state rather than falling back to code generation.

The following are prohibited in every milestone:

- dynamically generated or executed TSX;
- `eval`, `new Function`, runtime Babel, or arbitrary script execution;
- model-controlled module paths or component imports; and
- inserting untrusted HTML or script content into an iframe or the main page.

There is no OpenAI dependency or API route in Milestone 1.

## Verification gates

Before review, run:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Then inspect `/` and `/lab/kmeans` in a browser at mobile and desktop widths,
exercise all controls, and confirm that the console remains clear.

