import { ModuleKind, ModuleResolutionKind, ScriptTarget } from "monaco-editor/language/typescript/monaco.contribution";

export const javaScriptDiagnosticsOptions = {
  noSemanticValidation: false,
  noSyntaxValidation: false,
};

export const javaScriptCompilerOptions = {
  target: ScriptTarget.ES2020,
  module: ModuleKind.ESNext,
  moduleResolution: ModuleResolutionKind.NodeJs,
  allowJs: true,
  checkJs: false,
  strict: true,
  noEmit: true,
  allowSyntheticDefaultImports: true,
  esModuleInterop: true,
  allowNonTsExtensions: true,
  baseUrl: "file:///",
  paths: {
    "@/*": ["*"],
  },
  lib: ["es2022", "dom", "dom.iterable"],
};
