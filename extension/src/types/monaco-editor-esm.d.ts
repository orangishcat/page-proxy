declare module "monaco-editor/language/typescript/monaco.contribution" {
  export type JavaScriptDefaults = {
    setEagerModelSync: (value: boolean) => void;
    setDiagnosticsOptions: (options: { noSemanticValidation: boolean; noSyntaxValidation: boolean }) => void;
    setCompilerOptions: (options: JavaScriptCompilerOptions) => void;
    addExtraLib: (content: string, filePath?: string) => import("monaco-editor").IDisposable;
  };

  export type JavaScriptCompilerOptions = {
    target: number;
    module: number;
    moduleResolution: number;
    allowJs: boolean;
    checkJs: boolean;
    strict: boolean;
    noEmit: boolean;
    allowSyntheticDefaultImports: boolean;
    esModuleInterop: boolean;
    allowNonTsExtensions: boolean;
    baseUrl?: string;
    paths?: Record<string, string[]>;
    lib: string[];
  };

  export const javascriptDefaults: JavaScriptDefaults;

  export const ScriptTarget: {
    ES2020: number;
  };

  export const ModuleKind: {
    ESNext: number;
  };

  export const ModuleResolutionKind: {
    NodeJs: number;
  };
}

declare module "monaco-editor/languages/features/typescript/tsMode" {
  export const setupJavaScript: (
    defaults: import("monaco-editor/language/typescript/monaco.contribution").JavaScriptDefaults,
  ) => void;
}
