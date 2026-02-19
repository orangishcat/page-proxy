export type DefaultScriptConfig = {
  ppImportLines: readonly string[];
  defineBlockStart: string;
  defineBlockEnd: string;
};

export const buildDefaultScript = (websiteGlob: string, config: DefaultScriptConfig) => {
  const normalizedWebsite = websiteGlob.trim();
  return [
    ...config.ppImportLines,
    "",
    "// ==Page Proxy==",
    "// @title Page Proxy",
    normalizedWebsite ? `// @website ${normalizedWebsite}` : "// @website",
    "// @description",
    "// @author",
    "// @grant",
    "// ==/Page Proxy==",
    "",
    config.defineBlockStart,
    config.defineBlockEnd,
    "",
    'pv.notification("Hello world!");',
    "",
  ].join("\n");
};
