import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(testsDir, "..");
const workspaceDir = path.resolve(extensionDir, "..");
const { getPpSourceFiles, getPpSourceModuleSpecs, rewritePpImports } = (await import(
  "../scripts/pp-source-files.mjs"
)) as {
  getPpSourceFiles: (workspaceDir: string) => Promise<string[]>;
  getPpSourceModuleSpecs: (
    workspaceDir: string,
  ) => Promise<Array<{ sourceFile: string; moduleNames: string[] }>>;
  rewritePpImports: (source: string, sourceFile: string) => string;
};

describe("getPpSourceFiles", () => {
  test("includes every TypeScript source file under packages/pp/src", async () => {
    const sourceFiles = await getPpSourceFiles(workspaceDir);
    const relativeSourceFiles = sourceFiles.map((file) => path.relative(workspaceDir, file));

    expect(relativeSourceFiles).toContain("packages/pp/src/index.ts");
    expect(relativeSourceFiles).toContain("packages/pp/src/raw-imports.d.ts");
    expect(relativeSourceFiles).toContain("packages/pp/src/pp-api/createApi.ts");
    expect(relativeSourceFiles).toContain("packages/pp/src/pp-network/createNetwork.ts");
    expect(relativeSourceFiles).not.toContain("packages/pp/tests/pp-api.test.ts");
    expect(relativeSourceFiles.some((file) => file.endsWith(".css"))).toBe(false);
  });

  test("maps package exports to emitted declaration paths", async () => {
    const moduleSpecs = await getPpSourceModuleSpecs(workspaceDir);

    expect(moduleSpecs).toEqual([
      { sourceFile: "index.d.ts", moduleNames: ["@page-proxy/pp"] },
      { sourceFile: "pp-query/index.d.ts", moduleNames: ["@page-proxy/pp/pp-query"] },
      { sourceFile: "pp-style/index.d.ts", moduleNames: ["@page-proxy/pp/pp-style"] },
      { sourceFile: "pp-event/index.d.ts", moduleNames: ["@page-proxy/pp/pp-event"] },
      { sourceFile: "pp-api/index.d.ts", moduleNames: ["@page-proxy/pp/pp-api"] },
      { sourceFile: "pp-network/index.d.ts", moduleNames: ["@page-proxy/pp/pp-network"] },
      { sourceFile: "pp-storage/index.d.ts", moduleNames: ["@page-proxy/pp/pp-storage"] },
    ]);
  });

  test("rewrites nested relative imports against the declaration file path", () => {
    expect(rewritePpImports('export { tagMatches } from "./tagMatches";', "pp-query/index.d.ts")).toContain(
      'from "@page-proxy/pp/pp-query/tagMatches"',
    );
    expect(rewritePpImports('export { networkCacheKeyPrefix } from "../pp-storage";', "pp-network/index.d.ts")).toContain(
      'from "@page-proxy/pp/pp-storage"',
    );
  });
});
