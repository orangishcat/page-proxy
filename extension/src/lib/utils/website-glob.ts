import picomatch from "picomatch";
import {getUrlHostname, getUrlOrigin} from './url-utils';

const hasGlobWildcard = (value: string) => /[*?]/.test(value);
const hasSchemeHostOnlyPattern = (value: string) => /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]+$/.test(value);
const globMatchOptions = {bash: true};

export const matchWebsiteGlob = (pattern: string, url: string) => {
  const normalizedPattern = pattern.trim();
  const normalizedUrl = url.trim();
  if (!normalizedPattern || !normalizedUrl) {
    return false;
  }

  const hasScheme = normalizedPattern.includes('://');

  if (!hasGlobWildcard(normalizedPattern)) {
    return normalizedUrl.startsWith(normalizedPattern);
  }

  const matchTarget = !hasScheme
    ? getUrlHostname(normalizedUrl)
    : hasSchemeHostOnlyPattern(normalizedPattern)
      ? getUrlOrigin(normalizedUrl)
      : normalizedUrl;

  if (!matchTarget) {
    return false;
  }

  return picomatch.isMatch(matchTarget, normalizedPattern, globMatchOptions);
};

export const buildWebsiteGlobForUrl = (url: string) => {
  const origin = getUrlOrigin(url);
  return origin ? `${origin}/*` : '';
};
