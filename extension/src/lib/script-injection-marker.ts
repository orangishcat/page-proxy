export const scriptInjectionTagName = "page-proxy-script";
export const scriptIdAttribute = "script-id";

export const hashScriptCode = (code: string) => {
  // 64 bit FNV-1a hash
  let hash = 0xcbf29ce484222325n;

  for (let index = 0; index < code.length; index += 1) {
    hash ^= BigInt(code.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return hash.toString(16).padStart(16, "0");
};

export const markScriptInjected = (document: Document, code: string) => {
  const scriptId = hashScriptCode(code);
  const selector = `${scriptInjectionTagName}[${scriptIdAttribute}="${scriptId}"]`;

  if (document.querySelector(selector)) {
    return false;
  }

  const marker = document.createElement(scriptInjectionTagName);
  marker.setAttribute(scriptIdAttribute, scriptId);
  (document.head ?? document.documentElement).append(marker);
  return true;
};
