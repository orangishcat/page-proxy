import picomatch from "picomatch";

const globMatchOptions = { bash: true };
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "ws:", "wss:"]);

const toUrl = (url?: string) => {
  if (!url) {
    return null;
  }

  try {
    return new URL(url);
  } catch {
    return null;
  }
};

export const isAllowedUrl = (url?: string) => {
  const parsedUrl = toUrl(url);
  if (!parsedUrl) {
    return false;
  }
  return ALLOWED_PROTOCOLS.has(parsedUrl.protocol);
};

export const isRestrictedUrl = (url?: string) => !isAllowedUrl(url);

export const matchWebsiteGlob = (pattern: string, url: string) => {
  return picomatch(pattern.trim(), globMatchOptions)(url.trim());
};

export const buildWebsiteGlobForUrl = (url: string) => {
  const parsedUrl = toUrl(url);
  if (!parsedUrl || !ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    return "";
  }
  return `${parsedUrl.origin}/*`;
};
