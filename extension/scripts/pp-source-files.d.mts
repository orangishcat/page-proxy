export type PpSourceModuleSpec = {
  sourceFile: string;
  moduleNames: string[];
};

export function getPpSourceFiles(workspaceDir: string): Promise<string[]>;
export function getPpSourceModuleSpecs(workspaceDir: string): Promise<PpSourceModuleSpec[]>;
export function rewritePpImports(source: string, sourceFile: string): string;
