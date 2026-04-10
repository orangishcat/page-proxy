import { defaultBlankScriptTitle } from "./script-names";

export const defaultScriptVersion = "0.1.0";

export type DefaultScriptConfig = {
  ppImportLines: readonly string[];
  defineBlockStart: string;
  defineBlockEnd: string;
};

export const buildDefaultScript = (
  websiteGlob: string,
  config: DefaultScriptConfig,
  scriptTitle = defaultBlankScriptTitle,
) => {
  const normalizedWebsite = websiteGlob.trim();
  const normalizedTitle = scriptTitle.trim() || defaultBlankScriptTitle;
  return [
    ...config.ppImportLines,
    "",
    "// ==Page Proxy==",
    `// @title ${normalizedTitle}`,
    normalizedWebsite ? `// @website ${normalizedWebsite}` : "// @website",
    "// @description",
    `// @version ${defaultScriptVersion}`,
    "// @author",
    "// @grant",
    "// ==/Page Proxy==",
    "",
    config.defineBlockStart,
    config.defineBlockEnd,
    "",
    'pa.notification("Hello world!");',
    "",
  ].join("\n");
};
