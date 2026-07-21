# Paper-to-Prototype

> Don’t just read the method. Run it.

Paper-to-Prototype turns foundational algorithm papers into grounded,
interactive learning laboratories. Learners change real parameters, advance a
deterministic state machine, and inspect the calculation rather than receiving
another static summary.

Milestone 2 completes the verified three-laboratory gallery. Every laboratory
uses repository-owned algorithm code and a statically selected visualization;
none of the application UI or logic is generated at runtime.

## Verified laboratories

| Laboratory | Source paper | Route |
| --- | --- | --- |
| k-Means clustering | MacQueen (1967) | [`/lab/kmeans`](http://localhost:3000/lab/kmeans) |
| A* Search | Hart, Nilsson, and Raphael (1968) | [`/lab/astar`](http://localhost:3000/lab/astar) |
| Scaled Dot-Product Attention | Vaswani et al. (2017) | [`/lab/attention`](http://localhost:3000/lab/attention) |

The k-Means lab exposes assignment and centroid updates. The A* lab exposes its
frontier, visited set, current node, predecessor chain, path, and heuristic
weight. The Attention lab walks through the complete toy-vector pipeline from
input projections through weighted output. The attention example is a
mathematical demonstration, not a trained language model.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables
are required. `.env.example` reserves server-only configuration for a later
experimental paper-analysis milestone; never expose provider keys through a
`NEXT_PUBLIC_` variable.

## Quality checks

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Milestone review also validates `schema/extraction_schema.json` as JSON and
scans deployed source for forbidden runtime patterns such as `eval`,
`new Function`, runtime Babel, generated TSX, and OpenAI SDK usage.

## Architecture

- Next.js 15 App Router, React, strict TypeScript, and Tailwind CSS.
- Pure deterministic algorithm modules remain independent from React.
- A closed typed registry maps three known slugs to three trusted playgrounds.
- Visualizations use repository-owned SVG, HTML, and CSS.
- Browser state is ephemeral; there is no database or authentication.
- There is no OpenAI API integration, API route, PDF processing, export, saved
  history, or code editor in this milestone.
- The application never generates or executes arbitrary TSX or scripts.

A later experimental arXiv flow may ask GPT-5.6 for schema-validated structured
paper analysis. That response will remain untrusted data. Application code will
allowlist a supported method family and configure an existing engine; the model
will never supply executable UI code or a module path.

See [docs/PRD.md](docs/PRD.md) for product scope and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the trust boundary.

## Repository map

```text
app/                       Next.js routes, layout, and route states
components/playgrounds/    Trusted interactive laboratory views
data/golden-papers.ts      Typed catalog and original-paper metadata
docs/                      Product and architecture documentation
lib/algorithms/            Deterministic, UI-independent algorithms
lib/playgrounds/           Closed trusted-engine registry
prompts/                   Future structured-analysis prompt material
schema/                    Future model-output validation contract
```
