// Build-time paths for the worker's own Sharp, independent of Next's version.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export function shoeboxSharpIncludes(
  root = fileURLToPath(new URL("../", import.meta.url)),
) {
  const require = createRequire(join(root, "package.json"));
  const packageRoot = dirname(dirname(require.resolve("sharp")));
  const patterns = new Set(["./node_modules/sharp/**/*"]);
  const visited = new Set();
  function include(directory) {
    // Keep every installed alias, even for an already visited package. Native
    // libraries also use sibling paths from inside their own package scope.
    patterns.add(`./${relative(root, directory).replaceAll("\\", "/")}/**/*`);
    const actual = realpathSync(directory);
    if (visited.has(actual)) return;
    visited.add(actual);
    patterns.add(`./${relative(root, actual).replaceAll("\\", "/")}/**/*`);
    const metadataPath = join(actual, "package.json");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    const fromPackage = createRequire(metadataPath);
    for (const name of Object.keys({
      ...metadata.dependencies,
      ...metadata.optionalDependencies,
    })) {
      // Package exports may hide package.json; inspect Node's package lookup
      // directories instead of requiring an unexported subpath or loading code.
      const dependency = (fromPackage.resolve.paths(name) ?? [])
        .map((lookup) => join(lookup, name))
        .find((candidate) => existsSync(join(candidate, "package.json")));
      if (dependency) include(dependency);
      else if (!Object.hasOwn(metadata.optionalDependencies ?? {}, name)) {
        throw new Error(`Missing Sharp dependency: ${name}`);
      }
    }
  }
  include(packageRoot);
  return [...patterns];
}
