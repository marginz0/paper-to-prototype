# Paper-to-Prototype Product Requirements

## Product statement

Paper-to-Prototype is an education product that turns the algorithmic method
inside a research paper into a grounded, interactive learning laboratory.
Learners manipulate real parameters and observe the method step by step instead
of receiving another static paper summary.

**Tagline:** “Don’t just read the method. Run it.”

## Problem

Research papers often describe computational methods through dense prose,
notation, and static figures. Even when a reader understands each sentence, it
can be difficult to build an intuition for how state changes, which parameters
matter, and why the method converges or finds a solution. A small, faithful
interactive system can make those mechanics visible without pretending to
replace the paper.

## Product principles

1. **Mechanics before summary.** The main experience exposes the actual method,
   not a chat response about it.
2. **Grounded and deterministic.** Every displayed transition comes from trusted
   algorithm code and reproducible inputs.
3. **Explain the current step.** Controls, state, and plain-language explanation
   remain synchronized.
4. **Honest status.** Planned labs are visible as planned and never presented as
   complete.
5. **Safe by construction.** Model output may become data, never executable UI
   code.

## Final MVP scope

The product catalog contains exactly three verified laboratories:

| Laboratory | Core learning objective | Delivery status |
| --- | --- | --- |
| k-Means clustering | Connect assignment and centroid-update phases to cluster movement and inertia | Milestone 1 |
| A* Search | Observe frontier expansion and the effect of cost plus heuristic | Planned milestone |
| Scaled Dot-Product Attention | Observe query-key scores, scaling, softmax, and value mixing | Planned milestone |

## Milestone 1 requirements

### Landing page

- Present the tagline and a concise explanation of the learning problem.
- Display all three laboratories from one typed data source.
- Link the k-Means card to its working laboratory.
- Mark A* Search and Attention as planned without a misleading action.
- Use no invented metrics, testimonials, or claims.

### k-Means laboratory

- Use a deterministic seeded two-dimensional dataset.
- Support `k` values from 2 through 5.
- Advance one phase per step: cluster assignment, then centroid update.
- Calculate inertia from the current assignments and centroids.
- Provide Step, Play/Pause, Reset, `k`, and animation-speed controls.
- Reset reproducibly whenever the learner resets or changes `k`.
- Show the current phase, iteration, inertia, and a phase-specific explanation.
- Render an accessible SVG scatter plot with distinguishable points and clearly
  marked centroids.
- Work well at approximately 390 px viewport width and at a normal desktop
  width.

### Application foundation

- Use Next.js 15 App Router, React, strict TypeScript, and Tailwind CSS.
- Provide `/` and `/lab/[slug]` routes plus appropriate loading and not-found
  states.
- Keep deterministic algorithm code independent of React components.
- Provide reusable layout, header, and gallery-card components.
- Provide typecheck, test, lint, build, development, and production scripts.

## Explicit non-goals for Milestone 1

- Implementing the A* or Attention laboratory
- Calling OpenAI or any other model API
- Fetching or analyzing arXiv papers
- PDF upload
- Generating or executing TSX, JavaScript, or other model-produced code
- `eval`, `new Function`, runtime Babel, dynamic component compilation, or
  arbitrary script execution
- Authentication, database persistence, saved history, export, or a code editor
- shadcn setup unless a later, concrete component requirement justifies it

## Later experimental arXiv analysis

In a later milestone, GPT-5.6 may analyze paper text and return structured JSON
matching `schema/extraction_schema.json`. This flow is deliberately data-only:

1. The server obtains a bounded portion of paper text.
2. GPT-5.6 returns a structured method description.
3. Trusted code validates the response against the schema and rejects unknown
   or unsupported values.
4. Trusted application code maps a supported method family to an existing
   visualization engine and constructs a bounded configuration.
5. The browser runs only repository-owned algorithm and visualization code.

This later flow does not allow the model to generate a React component, choose
an arbitrary module, or provide executable code.

## Milestone 1 acceptance criteria

Milestone 1 is ready for review when:

- the landing page is coherent at mobile and desktop sizes;
- `/lab/kmeans` loads directly and presents the complete laboratory;
- assignment and centroid update are visibly distinct single-step phases;
- Step, Play, Pause, Reset, `k`, and speed controls work;
- a `k` change creates the same initial state every time for that `k`;
- the explanation and metrics match the displayed algorithm state;
- focused k-Means tests pass;
- lint, strict typecheck, and production build pass; and
- browser inspection finds no console errors.

