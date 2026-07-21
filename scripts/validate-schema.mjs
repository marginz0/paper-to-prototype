import { readFile } from "node:fs/promises";

const schemaPath = new URL("../schema/extraction_schema.json", import.meta.url);
const source = await readFile(schemaPath, "utf8");
const schema = JSON.parse(source);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  schema.$schema === "http://json-schema.org/draft-07/schema#",
  "Extraction schema must declare JSON Schema draft-07.",
);
assert(schema.type === "object", "Extraction schema root must be an object.");
assert(
  schema.additionalProperties === false,
  "Extraction schema must reject unknown root properties.",
);
assert(
  Array.isArray(schema.required) && schema.required.length > 0,
  "Extraction schema must declare required fields.",
);
assert(
  schema.properties && typeof schema.properties === "object",
  "Extraction schema must declare properties.",
);

for (const field of schema.required) {
  assert(
    Object.hasOwn(schema.properties, field),
    `Required field ${field} is missing from schema properties.`,
  );
}

const supportedFamilies = schema.properties.method_family?.enum;
assert(
  Array.isArray(supportedFamilies) &&
    ["kmeans", "astar", "scaled_dot_product_attention", "unsupported"].every(
      (family) => supportedFamilies.includes(family),
    ),
  "Method-family allowlist is incomplete.",
);

console.log(
  `Schema validation passed: ${schema.required.length} required fields and ${supportedFamilies.length} method families.`,
);
