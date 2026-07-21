# Retired Runtime Code-Generation Prompt

This filename is retained to document a superseded prototype concept. It is not
used by Milestone 3 and must never be wired into the deployed application.

The original concept asked a model to generate a `MethodPlayground.tsx`
component and execute it. The locked architecture permanently prohibits that
design. Paper-to-Prototype does not generate, compile, import, or execute
model-produced TSX, JavaScript, HTML, or scripts.

## What Codex does

Codex was used as a development agent to implement, review, test, and polish the
repository-owned deterministic k-Means, A*, and scaled dot-product Attention
engines and their React learning experiences.

Codex is not part of the deployed runtime. The application contains no Codex
SDK, does not ask Codex to generate a laboratory, and does not execute Codex
output in a browser or server process.

## What GPT-5.6 does

The experimental `/analyze` flow uses the official OpenAI JavaScript SDK
Responses API. GPT-5.6 returns only structured educational method-analysis data
under the contract documented in `prompts/extraction_prompt.md`.

Trusted application code then:

1. parses the output with a strict Zod schema;
2. runs a separate family/compatibility/confidence/slug consistency validator;
3. verifies that the returned arXiv ID equals the requested canonical ID;
4. rejects unknown, unsupported, inconsistent, or low-confidence matches; and
5. resolves a valid known slug through the statically compiled trusted registry.

The model does not select an import path, author React code, supply an algorithm,
create a registry entry, override application limits, or configure an arbitrary
engine. There is no generated-code fallback when no laboratory is compatible.

## Permanent safety constraints

- No dynamically generated or executed TSX
- No `eval` or `new Function`
- No runtime Babel or equivalent compilation
- No arbitrary script or HTML execution
- No model-controlled dynamic imports or module paths
- No iframe `srcdoc` rendering of model output
- No treating paper instructions as application instructions
