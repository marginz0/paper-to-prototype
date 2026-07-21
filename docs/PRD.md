# Paper-to-Prototype Product Requirements

## Product statement

Paper-to-Prototype is an education product that turns the algorithmic method
inside a research paper into a grounded, interactive learning laboratory.
Learners manipulate real parameters and observe each method step by step.

**Tagline:** “Don’t just read the method. Run it.”

## Problem

Papers describe computational methods through precise prose, notation, and
static figures. A reader can understand the words without building intuition
for the transitions between states. A small faithful laboratory makes those
transitions inspectable without pretending to replace the paper.

## Product principles

1. **Mechanics before summary.** The primary experience exposes the real method.
2. **Grounded and deterministic.** Trusted code produces every displayed state.
3. **Explain the current step.** Controls, metrics, and prose remain synchronized.
4. **Verified means complete.** A gallery card becomes active only after its
   algorithm, route, controls, tests, and responsive behavior are verified.
5. **Safe by construction.** Future model output may be data, never executable UI.
6. **Accuracy before spectacle.** Motion is restrained and educational claims
   remain within what each small demonstration actually shows.

## Verified MVP collection

| Laboratory | Core learning objective | Delivery |
| --- | --- | --- |
| k-Means clustering | Connect assignment and centroid updates to geometry and inertia | Milestone 1 |
| A* Search | Inspect frontier expansion and the balance of cost and heuristic | Milestone 2 |
| Scaled Dot-Product Attention | Follow projection, scoring, scaling, softmax, and value mixing | Milestone 2 |

## Milestone 2 requirements

### Shared gallery and routing

- All three cards are active and resolve through one typed catalog.
- `/lab/kmeans`, `/lab/astar`, and `/lab/attention` load directly.
- Unknown slugs render the application not-found state.
- Every lab links to its original paper and uses short original explanatory copy.
- A static registry selects only compiled, repository-owned playgrounds.

### k-Means laboratory

Milestone 1 remains unchanged in behavior: a reproducible seeded 2D dataset,
`k` from 2 through 5, alternating assignment/update phases, inertia, playback,
single-step control, speed, and exact reset.

### A* Search laboratory

- Use a rectangular grid, four-directional movement, Manhattan distance, and
  deterministic tie-breaking.
- Maintain explicit open and closed sets, current node, predecessor map, and
  final path in a step-based state machine.
- Expose heuristic weight from 0 through 2. Explain that 0 is uniform-cost
  search, 1 is standard A*, and values above 1 can sacrifice optimality.
- Display `f(n) = g(n) + w × h(n)` plus current f, g, and h, nodes expanded,
  frontier size, and path length/cost.
- Include a deterministic preset, editing for walls/start/goal, mobile tap,
  Play/Pause, Step, Restart Search, Reset Board, and animation speed.
- Distinguish board states with labels, marks, or shape as well as color.
- Correctly handle a path, no path, start equals goal, and reset.

### Scaled Dot-Product Attention laboratory

- Start with fixed toy token vectors and fixed projection matrices.
- Compute `Q = XWq`, `K = XWk`, `V = XWv`, `QKᵀ`, division by `√dₖ`,
  temperature-controlled row softmax, and `attention weights × V`.
- Step through six named phases with Previous, Next, and Reset controls.
- Default to scaled attention and offer an explicit scaled/unscaled comparison.
- Provide temperature from approximately 0.4 through 2 with immediate updates.
- Render a labeled attention heatmap; cell selection reveals the query, key,
  raw score, scaled score, and final weight.
- Show the selected row’s most-attended key, approximate sum of 1, and entropy.
- State clearly that this is a deterministic mathematical toy, not a trained
  language model or evidence of genuine linguistic understanding.

### Responsive and accessibility quality

- The landing page and every laboratory support 1440 × 1000 and 390 × 844.
- Controls remain usable by keyboard and touch with visible focus indicators.
- Required information does not rely on color alone.
- Labels remain readable without horizontal page overflow.
- Reduced-motion preferences suppress nonessential transitions.
- Browser consoles remain free of errors and warnings.

## Explicit non-goals

- OpenAI SDK or API routes
- arXiv fetching or PDF processing
- authentication, database persistence, saved history, or export
- code editor, shadcn setup, or unrelated features
- generated or executed TSX, `eval`, `new Function`, runtime Babel, arbitrary
  scripts, model-controlled imports, or untrusted iframe content

## Later experimental arXiv analysis

In a later milestone, GPT-5.6 may return structured JSON matching
`schema/extraction_schema.json`. The server will validate the response, reject
unsupported values, and map an allowlisted method family to an existing trusted
engine with bounded configuration. Model output will never be source code.

## Milestone 2 acceptance criteria

Milestone 2 is ready for review when all three direct routes and the gallery are
coherent, every required control works, each pure engine’s focused tests pass,
strict typecheck/lint/build pass, schema and forbidden-pattern checks pass, and
desktop/mobile browser inspection finds no overflow or console errors.
