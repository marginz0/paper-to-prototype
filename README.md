# Paper-to-Prototype

> Don’t just read the method. Run it.

Paper-to-Prototype turns the algorithmic method inside a research paper into a
grounded, interactive learning laboratory. Instead of another static summary,
learners manipulate real parameters and watch the method advance one step at a
time.

Milestone 1 delivers the application foundation and a complete k-Means lab.
A* Search and Scaled Dot-Product Attention are represented honestly as planned
labs; they are not implemented yet.

## Laboratory status

| Laboratory | Source paper | Status |
| --- | --- | --- |
| k-Means clustering | MacQueen (1967) | Available in Milestone 1 |
| A* Search | Hart, Nilsson, and Raphael (1968) | Planned |
| Scaled Dot-Product Attention | Vaswani et al. (2017) | Planned |

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The k-Means laboratory is
also available directly at
[http://localhost:3000/lab/kmeans](http://localhost:3000/lab/kmeans).

Milestone 1 has no required environment variables. Do not add an API key to run
the current application; `.env.example` documents the later analysis milestone.

## Quality checks

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

## Architecture

- Next.js 15 App Router, strict TypeScript, React, and Tailwind CSS.
- Deterministic algorithm modules are separate from React playgrounds.
- Visualizations use trusted, repository-owned SVG or Recharts engines.
- The k-Means dataset and initialization are seeded and reproducible.
- There is no database, authentication, PDF upload, export, saved history, or
  code editor in this milestone.
- There is no OpenAI API integration in this milestone.
- The application never generates, evaluates, or executes arbitrary TSX or
  scripts. `eval`, `new Function`, runtime Babel, and equivalent mechanisms are
  prohibited.

A later experimental arXiv flow may ask GPT-5.6 for schema-validated structured
paper analysis. That output will be treated as untrusted data. Application code
will select and configure a compatible visualization from a fixed registry; the
model will not create executable UI code.

See [docs/PRD.md](docs/PRD.md) for product scope and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical boundaries.

## Repository map

```text
app/                       Next.js routes, layouts, and route states
components/                Shared UI and laboratory playgrounds
data/golden-papers.ts      Typed catalog of the three verified laboratories
docs/                      Product and architecture documentation
lib/algorithms/            Deterministic, UI-independent algorithms
prompts/                   Future structured-analysis prompt material
schema/                    Future model-output validation contract
```

The normalized paths above are canonical and reflect the locked scope. Earlier
planning inputs have been consolidated into these product, architecture, data,
prompt, and schema sources so the repository has one consistent direction.
