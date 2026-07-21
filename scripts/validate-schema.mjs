import { readFile } from "node:fs/promises";

const schemaPath = new URL(
  "../schema/method-analysis.schema.json",
  import.meta.url,
);
const source = await readFile(schemaPath, "utf8");
const schema = JSON.parse(source);

const rootFields = [
  "arxiv_id",
  "paper_title",
  "authors",
  "method_name",
  "one_liner",
  "learning_goal",
  "steps",
  "parameters",
  "detected_method_family",
  "compatibility",
  "supported_lab_slug",
  "match_reason",
  "confidence",
  "evidence",
  "limitations",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExactMembers(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array.`);
  assert(
    actual.length === expected.length &&
      expected.every((value) => actual.some((item) => Object.is(item, value))),
    `${label} must contain exactly: ${expected.join(", ")}.`,
  );
}

function assertExactKeys(object, expected, label) {
  assert(
    object && typeof object === "object" && !Array.isArray(object),
    `${label} must be an object.`,
  );
  assertExactMembers(Object.keys(object), expected, `${label} keys`);
}

function assertStringSchema(node, label, minLength, maxLength) {
  assert(node?.type === "string", `${label} must be a string.`);
  assert(node.minLength === minLength, `${label} minLength must be ${minLength}.`);
  assert(node.maxLength === maxLength, `${label} maxLength must be ${maxLength}.`);
}

function assertStringArray(node, label, bounds) {
  assert(node?.type === "array", `${label} must be an array.`);
  assert(node.minItems === bounds.min, `${label} minItems must be ${bounds.min}.`);
  assert(node.maxItems === bounds.max, `${label} maxItems must be ${bounds.max}.`);
  assertStringSchema(
    node.items,
    `${label} items`,
    bounds.itemMinLength,
    bounds.itemMaxLength,
  );
}

function assertStrictObject(node, label, fields) {
  assert(node?.type === "object", `${label} must be an object.`);
  assert(
    node.additionalProperties === false,
    `${label} must reject unknown properties.`,
  );
  assertExactMembers(node.required, fields, `${label} required fields`);
  assertExactKeys(node.properties, fields, `${label} properties`);
}

assert(
  schema.$schema === "https://json-schema.org/draft/2020-12/schema",
  "Method-analysis schema must declare JSON Schema draft 2020-12.",
);
assert(
  schema.$id ===
    "https://paper-to-prototype.local/schema/method-analysis.schema.json",
  "Method-analysis schema must retain its canonical $id.",
);
assert(schema.title === "MethodAnalysis", "Schema title must be MethodAnalysis.");
assertStrictObject(schema, "Method-analysis schema root", rootFields);

const properties = schema.properties;
assert(
  typeof properties.arxiv_id.pattern === "string",
  "arxiv_id must declare a canonical modern identifier pattern.",
);
const arxivIdPattern = new RegExp(properties.arxiv_id.pattern);
for (const acceptedId of ["0704.0001", "1706.03762", "1706.03762v7"]) {
  assert(
    arxivIdPattern.test(acceptedId),
    "arxiv_id pattern must accept " + acceptedId + ".",
  );
}
for (const rejectedId of [
  "0703.0001",
  "0704.00001",
  "1501.0001",
  "1706.00000",
  "1706.03762v0",
]) {
  assert(
    !arxivIdPattern.test(rejectedId),
    "arxiv_id pattern must reject " + rejectedId + ".",
  );
}
assertStringSchema(properties.arxiv_id, "arxiv_id", undefined, undefined);
assertStringSchema(properties.paper_title, "paper_title", 1, 300);
assertStringArray(properties.authors, "authors", {
  min: 1,
  max: 30,
  itemMinLength: 1,
  itemMaxLength: 160,
});
assertStringSchema(properties.method_name, "method_name", 1, 160);
assertStringSchema(properties.one_liner, "one_liner", 1, 300);
assertStringSchema(properties.learning_goal, "learning_goal", 1, 400);
assertStringArray(properties.steps, "steps", {
  min: 3,
  max: 7,
  itemMinLength: 1,
  itemMaxLength: 240,
});
assertStringSchema(properties.match_reason, "match_reason", 1, 500);
assertStringArray(properties.limitations, "limitations", {
  min: 1,
  max: 4,
  itemMinLength: 1,
  itemMaxLength: 300,
});

assertExactMembers(
  properties.detected_method_family.enum,
  [
    "kmeans_clustering",
    "astar_search",
    "scaled_dot_product_attention",
    "other",
  ],
  "detected_method_family enum",
);
assertExactMembers(
  properties.compatibility.enum,
  ["supported", "unsupported"],
  "compatibility enum",
);
assertExactMembers(
  properties.supported_lab_slug.enum,
  ["kmeans", "astar", "attention", null],
  "supported_lab_slug enum",
);
assertExactMembers(
  properties.confidence.enum,
  ["high", "medium", "low"],
  "confidence enum",
);

assert(
  properties.parameters.type === "array" &&
    properties.parameters.minItems === 0 &&
    properties.parameters.maxItems === 5 &&
    properties.parameters.items?.$ref === "#/$defs/parameter",
  "parameters must contain 0 through 5 strict parameter objects.",
);
assert(
  properties.evidence.type === "array" &&
    properties.evidence.minItems === 1 &&
    properties.evidence.maxItems === 3 &&
    properties.evidence.items?.$ref === "#/$defs/evidence",
  "evidence must contain 1 through 3 strict evidence objects.",
);

assertExactKeys(schema.$defs, ["parameter", "evidence"], "$defs");
const parameter = schema.$defs.parameter;
assertStrictObject(parameter, "parameter definition", [
  "name",
  "meaning",
  "effect",
]);
assertStringSchema(parameter.properties.name, "parameter.name", 1, 120);
assertStringSchema(parameter.properties.meaning, "parameter.meaning", 1, 300);
assertStringSchema(parameter.properties.effect, "parameter.effect", 1, 300);

const evidence = schema.$defs.evidence;
assertStrictObject(evidence, "evidence definition", [
  "paper_section",
  "page_number",
  "paraphrased_support",
]);
assertStringSchema(
  evidence.properties.paper_section,
  "evidence.paper_section",
  1,
  160,
);
assertExactMembers(
  evidence.properties.page_number.type,
  ["integer", "null"],
  "evidence.page_number types",
);
assert(
  evidence.properties.page_number.minimum === 1,
  "evidence.page_number must be positive when present.",
);
assertStringSchema(
  evidence.properties.paraphrased_support,
  "evidence.paraphrased_support",
  1,
  600,
);

console.log(
  `Schema validation passed for schema/method-analysis.schema.json: ${rootFields.length} required fields, 4 method families, and strict parameter/evidence objects.`,
);
