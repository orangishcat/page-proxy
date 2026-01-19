import {getUrlHostname, getUrlOrigin} from './url-utils';

const globSpecialChars = /[.+^${}()|[\]\\]/g;
const hasGlobWildcard = (value: string) => /[*?]/.test(value);

const globToRegex = (pattern: string) => {
  const escaped = pattern.replace(globSpecialChars, '\\$&');
  const regex = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
  return new RegExp(regex, 'i');
};

export const matchWebsiteGlob = (pattern: string, url: string) => {
  const normalizedPattern = pattern.trim();
  if (!normalizedPattern) {
    return false;
  }

  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return false;
  }

  const hasScheme = normalizedPattern.includes('://');
  if (!hasScheme) {
    const hostname = getUrlHostname(normalizedUrl);
    if (!hostname) {
      return false;
    }
    return globToRegex(normalizedPattern).test(hostname);
  }

  if (!hasGlobWildcard(normalizedPattern)) {
    return normalizedUrl.startsWith(normalizedPattern);
  }

  return globToRegex(normalizedPattern).test(normalizedUrl);
};

export const buildWebsiteGlobForUrl = (url: string) => {
  const origin = getUrlOrigin(url);
  if (!origin) {
    return '';
  }
  return `${origin}/*`;
};
