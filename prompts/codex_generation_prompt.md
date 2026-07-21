# Retired Code-Generation Prompt

This filename is retained to document a superseded prototype concept. It is not
used by Milestone 1 and must not be wired into the deployed application.

The original design asked a model to generate a `MethodPlayground.tsx` component
and then execute it. The locked architecture explicitly prohibits that design.
Paper-to-Prototype does not generate, compile, import, or execute model-produced
TSX, JavaScript, HTML, or scripts.

## Replacement contract for a later milestone

GPT-5.6 may return only schema-validated structured paper analysis as described
in `prompts/extraction_prompt.md`. Trusted application code then:

1. validates the JSON against `schema/extraction_schema.json`;
2. rejects unknown or unsupported method families;
3. selects a statically imported, repository-owned algorithm and visualization
   engine from an allowlisted registry; and
4. constructs a bounded configuration using application-defined defaults and
   limits.

The model does not select an import path, author React code, supply a script, or
override application limits. There is no fallback to generated code when no
engine is compatible.

## Permanent safety constraints

- No dynamically generated or executed TSX
- No `eval` or `new Function`
- No runtime Babel or equivalent compilation
- No arbitrary script or HTML execution
- No model-controlled dynamic imports
- No iframe `srcdoc` rendering of model output
