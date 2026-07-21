# Repository Guidelines

## Scope

Paper-to-Prototype is an education product with three verified laboratory
families: k-Means, A* Search, and Scaled Dot-Product Attention. Milestone 2
implements and verifies the complete three-laboratory gallery while preserving
the accepted Milestone 1 k-Means experience.

The current user brief and `docs/PRD.md` override legacy root planning files
where they conflict.

## Architecture guardrails

- Use Next.js 15 App Router, React, strict TypeScript, and Tailwind CSS.
- Keep algorithm implementations deterministic and independent from React UI.
- Use a seeded PRNG for randomized examples; do not call `Math.random()`.
- Render with trusted repository-owned SVG or Recharts components.
- Resolve labs through an explicit typed registry. Never derive an import path
  from request or model input.
- Do not add a database, authentication, PDF upload, export, saved history, or a
  code editor in this milestone.
- Do not add OpenAI API routes, SDKs, or client calls in this milestone.
- Do not generate or execute TSX. `eval`, `new Function`, runtime Babel,
  arbitrary scripts, model-controlled dynamic imports, and untrusted iframe
  content are prohibited.
- Add shadcn only if a concrete existing component requires it.

## Data and future model output

`data/golden-papers.ts` is the catalog source of truth. Catalog status must stay
honest: a lab is `available` only when its route and interaction are verified.

The `prompts/` and `schema/` directories describe a later experimental GPT-5.6
paper-analysis flow. Model output is untrusted structured data. Validate it and
map supported method families to prebuilt engines in trusted application code;
never turn it into executable code.

## Working conventions

- Preserve unrelated user changes.
- Prefer small, typed modules and explicit state transitions.
- Give controls accessible names, keyboard focus styles, and readable states.
- Check the gallery and all three routes near 390 px and at desktop width.
- Keep the mathematical Attention example clearly labeled as untrained.

Before handing off implementation work, run:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Report exact results and any browser-console or responsive-layout limitations.
