import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoots = ["app", "components", "lib"];
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const rules = [
  ["eval", /\beval\s*\(/],
  ["new Function", /\bnew\s+Function\s*\(/],
  ["runtime Babel", /@babel\/(?:core|standalone)|babel-standalone/],
  ["OpenAI SDK", /(?:from\s+|require\s*\()\s*["']openai["']/],
  ["untrusted HTML injection", /dangerouslySetInnerHTML/],
  ["variable dynamic import", /\bimport\s*\(\s*[^"'`]/],
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(entryPath);
      return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

const sourceFiles = (
  await Promise.all(sourceRoots.map((root) => collectFiles(path.join(projectRoot, root))))
).flat();
const findings = [];

for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  for (const [label, pattern] of rules) {
    if (pattern.test(source)) {
      findings.push(`${path.relative(projectRoot, file)}: ${label}`);
    }
  }
}

const algorithmFiles = sourceFiles.filter((file) =>
  file.includes(`${path.sep}lib${path.sep}algorithms${path.sep}`),
);
for (const file of algorithmFiles) {
  if (/Math\.random\s*\(/.test(await readFile(file, "utf8"))) {
    findings.push(`${path.relative(projectRoot, file)}: unseeded Math.random`);
  }
}

const appEntries = await collectFiles(path.join(projectRoot, "app"));
for (const file of appEntries) {
  if (/route\.(?:js|ts)$/.test(file)) {
    findings.push(`${path.relative(projectRoot, file)}: API route`);
  }
}

const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
if (packageJson.dependencies?.openai || packageJson.devDependencies?.openai) {
  findings.push("package.json: OpenAI SDK dependency");
}

if (findings.length > 0) {
  console.error("Forbidden runtime pattern scan failed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(`Forbidden runtime pattern scan passed across ${sourceFiles.length} source files.`);
}
