import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import picomatch from "picomatch";

const ppPackageName = "@page-proxy/pp";

const getPpPackageDir = (workspaceDir) => path.join(workspaceDir, "packages/pp");
const getPpPackageSrcDir = (workspaceDir) => path.join(getPpPackageDir(workspaceDir), "src");
const getPpPackageJsonPath = (workspaceDir) => path.join(getPpPackageDir(workspaceDir), "package.json");

const comparePaths = (left, right) => left.localeCompare(right);
const isTypeScriptFile = picomatch("**/*.ts");

const toModuleName = (exportKey) =>
  exportKey === "." ? ppPackageName : `${ppPackageName}/${exportKey.replace(/^\.\//, "")}`;

const toDeclarationFile = (exportPath) => exportPath.replace(/^\.\/src\//, "").replace(/\.ts$/, ".d.ts");
const toPpModuleSpecifier = (specifier, sourceFile) => {
  const resolvedPath = path.posix.normalize(path.posix.join(path.posix.dirname(sourceFile), specifier));
  return `${ppPackageName}/${resolvedPath.replace(/^\.\//, "")}`;
};

const collectTypeScriptFiles = async (dirPath, rootDir) => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        return collectTypeScriptFiles(entryPath, rootDir);
      }

      const relativePath = path.relative(rootDir, entryPath).split(path.sep).join("/");
      return isTypeScriptFile(relativePath) ? [entryPath] : [];
    }),
  );

  return nestedFiles.flat();
};

export const getPpSourceFiles = async (workspaceDir) => {
  const ppPackageSrcDir = getPpPackageSrcDir(workspaceDir);
  const sourceFiles = await collectTypeScriptFiles(ppPackageSrcDir, ppPackageSrcDir);
  return sourceFiles.sort(comparePaths);
};

export const getPpSourceModuleSpecs = async (workspaceDir) => {
  const packageJson = JSON.parse(await readFile(getPpPackageJsonPath(workspaceDir), "utf8"));

  return Object.entries(packageJson.exports).map(([exportKey, exportPath]) => {
    if (typeof exportPath !== "string") {
      throw new Error(`Unsupported export target for ${exportKey}`);
    }

    return {
      sourceFile: toDeclarationFile(exportPath),
      moduleNames: [toModuleName(exportKey)],
    };
  });
};

export const rewritePpImports = (source, sourceFile) =>
  source
    .replace(/import\("((?:\.{1,2}\/)[^"]+)"\)/g, (_, specifier) => `import("${toPpModuleSpecifier(specifier, sourceFile)}")`)
    .replace(/from "((?:\.{1,2}\/)[^"]+)"/g, (_, specifier) => `from "${toPpModuleSpecifier(specifier, sourceFile)}"`);
