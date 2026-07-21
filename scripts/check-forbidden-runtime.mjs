import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoots = ["app", "components", "lib", "pages"];
const sourceExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);
const allowedApiRoute = "app/api/analyze/route.ts";

const rules = [
  ["eval", /\beval\s*\(/],
  ["new Function", /\bnew\s+(?:globalThis\s*\.\s*)?Function\s*\(/],
  ["runtime Babel", /@babel\/(?:core|standalone)|babel-standalone/],
  [
    "dangerous HTML injection",
    /\bdangerouslySetInnerHTML\b|\bsrcDoc\s*=|\.(?:innerHTML|outerHTML)\s*=|\binsertAdjacentHTML\s*\(|\bdocument\s*\.\s*write(?:ln)?\s*\(|\bcreateContextualFragment\s*\(/,
  ],
  [
    "runtime code sandbox",
    /(?:from\s+|require\s*\(\s*)["'](?:node:)?vm["']|["'](?:isolated-vm|vm2)["']/,
  ],
  [
    "model-generated code contract",
    /\b(?:generated(?:Tsx|Jsx|Code|Script|Component|Source)|generated_(?:tsx|jsx|code|script|component|source)|modelGenerated(?:Tsx|Jsx|Code|Script|Component|Source)|model_generated_(?:tsx|jsx|code|script|component|source)|(?:component|tsx|jsx)(?:Code|Source)|(?:component|tsx|jsx)_(?:code|source)|(?:execute|compile|transpile|evaluate|run)(?:Generated|ModelGenerated)(?:Code|Tsx|Jsx|Script|Component)?|(?:execute|compile|transpile|evaluate|run)ModelOutput|(?:execute|compile|transpile|evaluate|run)_(?:generated_code|model_output))\b/i,
  ],
];

const openAiSdkImport =
  /(?:\bfrom\s+|\bimport\s+|\brequire\s*\(\s*|\bimport\s*\(\s*)["']openai(?:\/[^"']*)?["']/;
const otherOpenAiPackageImport =
  /(?:\bfrom\s+|\bimport\s+|\brequire\s*\(\s*|\bimport\s*\(\s*)["']@openai\/[^"']+["']/;
const clientDirective = /(?:^|\n)\s*["']use client["']\s*;?/;
const serverOnlyImport = /\bimport\s+["']server-only["']/;

async function collectFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(entryPath);
      return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

function projectPath(file) {
  return path.relative(projectRoot, file).split(path.sep).join("/");
}

function isTestModule(relativePath) {
  return /(?:^|\/)__tests__(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(
    relativePath,
  );
}

function isAllowedOpenAiServerModule(relativePath, source) {
  if (clientDirective.test(source)) return false;
  if (relativePath === allowedApiRoute) return true;
  if (!relativePath.startsWith("lib/ai/")) return false;

  // Type-only SDK imports in tests are erased. Deployed analysis modules must
  // make their server boundary explicit so a future client import fails closed.
  return isTestModule(relativePath) || serverOnlyImport.test(source);
}

function hasVariableDynamicImport(source) {
  const importCall = /\bimport\s*\(/g;
  let match;

  while ((match = importCall.exec(source)) !== null) {
    const openParenthesis = source.indexOf("(", match.index);
    const closeParenthesis = findMatchingParenthesis(source, openParenthesis);
    if (closeParenthesis < 0) return true;

    const argument = source.slice(openParenthesis + 1, closeParenthesis).trim();
    if (!isStaticModuleSpecifier(argument)) return true;
    importCall.lastIndex = closeParenthesis + 1;
  }

  return false;
}

function findMatchingParenthesis(source, openParenthesis) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openParenthesis; index < source.length; index += 1) {
    const character = source[index];

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function isStaticModuleSpecifier(argument) {
  if (argument.length < 2) return false;
  const quote = argument[0];
  if (quote !== '"' && quote !== "'" && quote !== "`") return false;
  if (argument.at(-1) !== quote) return false;
  if (quote === "`" && argument.includes("${")) return false;

  let escaped = false;
  for (let index = 1; index < argument.length - 1; index += 1) {
    const character = argument[index];
    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === quote) {
      return false;
    }
  }
  return !escaped;
}

const sourceFiles = (
  await Promise.all(
    sourceRoots.map((root) => collectFiles(path.join(projectRoot, root))),
  )
).flat();
const findings = [];

for (const file of sourceFiles) {
  const relativePath = projectPath(file);
  const source = await readFile(file, "utf8");

  for (const [label, pattern] of rules) {
    if (pattern.test(source)) findings.push(`${relativePath}: ${label}`);
  }

  if (hasVariableDynamicImport(source)) {
    findings.push(`${relativePath}: variable dynamic import`);
  }

  if (openAiSdkImport.test(source)) {
    if (clientDirective.test(source)) {
      findings.push(`${relativePath}: OpenAI SDK import in client module`);
    } else if (!isAllowedOpenAiServerModule(relativePath, source)) {
      findings.push(`${relativePath}: OpenAI SDK outside server analysis module`);
    }
  }

  if (otherOpenAiPackageImport.test(source)) {
    findings.push(`${relativePath}: non-allowlisted OpenAI runtime package`);
  }

  if (
    relativePath.startsWith("lib/algorithms/") &&
    /\bMath\s*\.\s*random\s*\(/.test(source)
  ) {
    findings.push(`${relativePath}: unseeded Math.random`);
  }

  const isAppRoute =
    relativePath.startsWith("app/") &&
    /(?:^|\/)route\.[cm]?[jt]s$/.test(relativePath);
  const isPagesApiRoute = relativePath.startsWith("pages/api/");
  if (
    (isAppRoute || isPagesApiRoute) &&
    relativePath !== allowedApiRoute
  ) {
    findings.push(`${relativePath}: unauthorized API route`);
  }
}

const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
for (const dependencyGroup of ["dependencies", "devDependencies", "optionalDependencies"]) {
  for (const packageName of Object.keys(packageJson[dependencyGroup] ?? {})) {
    if (packageName.startsWith("@openai/") || packageName.startsWith("openai-")) {
      findings.push(
        `package.json: non-allowlisted OpenAI package ${packageName} in ${dependencyGroup}`,
      );
    }
  }
}

if (findings.length > 0) {
  console.error("Forbidden runtime pattern scan failed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(
    `Forbidden runtime pattern scan passed across ${sourceFiles.length} source files; ${allowedApiRoute} is the sole API route allowlisted.`,
  );
}
