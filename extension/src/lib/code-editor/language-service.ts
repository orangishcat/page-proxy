import {
  javascriptDefaults,
} from "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";
import ppModuleDeclarations from "@/types/pp-monaco-extra-lib.txt?raw";
import { javaScriptCompilerOptions, javaScriptDiagnosticsOptions } from "./language-service-options";

let ppTypesRegistered = false;
let languageServiceConfigured = false;

const ppGlobalDeclarations = `
import * as paModule from "@page-proxy/pp/pp-api";
import * as pnModule from "@page-proxy/pp/pp-network";
import * as pqModule from "@page-proxy/pp/pp-query";
import * as psModule from "@page-proxy/pp/pp-style";
import * as ptModule from "@page-proxy/pp/pp-storage";
import * as pvModule from "@page-proxy/pp/pp-event";

declare global {
  const pa: typeof paModule;
  const pn: typeof pnModule;
  const pq: typeof pqModule;
  const ps: typeof psModule;
  const pt: ReturnType<typeof ptModule.createStorage>;
  const pv: typeof pvModule;
  const pp: typeof paModule.pp;
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
