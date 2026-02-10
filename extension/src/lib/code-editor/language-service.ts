import {
  javascriptDefaults,
} from "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";
import ppModuleDeclarations from "@/types/pp-monaco-extra-lib.txt?raw";
import { javaScriptCompilerOptions, javaScriptDiagnosticsOptions } from "./language-service-options";

let ppTypesRegistered = false;
let languageServiceConfigured = false;

const ppGlobalDeclarations = `
import * as pqModule from "@/lib/pp/pp-query";
import * as psModule from "@/lib/pp/pp-style";
import * as paModule from "@/lib/pp/pp-api";
import * as pvModule from "@/lib/pp/pp-event";

declare global {
  const pq: typeof pqModule;
  const ps: typeof psModule;
  const pa: typeof paModule;
  const pv: typeof pvModule;
}

export {};
`;

export const configureJavaScriptLanguageService = () => {
  if (languageServiceConfigured) {
    return;
  }

  const defaults = javascriptDefaults;
  defaults.setEagerModelSync(true);
  defaults.setDiagnosticsOptions(javaScriptDiagnosticsOptions);
  defaults.setCompilerOptions(javaScriptCompilerOptions);

  if (!ppTypesRegistered) {
    defaults.addExtraLib(ppModuleDeclarations, "file:///page-proxy/pp-modules.d.ts");
    defaults.addExtraLib(ppGlobalDeclarations, "file:///page-proxy/pp-globals.d.ts");
    ppTypesRegistered = true;
  }

  languageServiceConfigured = true;
};
