const restrictedPrefixes = [
  'chrome://',
  'brave://',
  'edge://',
  'about:',
  'chrome-extension://',
  'moz-extension://',
  'view-source:'
];

export const isRestrictedUrl = (url: string | undefined) => {
  if (!url) {
    return true;
  }

  const normalized = url.toLowerCase();
  if (restrictedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  return false;
};

export const getUrlOrigin = (url: string | undefined) => {
  if (!url) {
    return '';
  }

  const match = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]+)/);
  return match ? match[1] : '';
};

export const getUrlHostname = (url: string | undefined) => {
  if (!url) {
    return '';
  }

  const match = url.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/);
  return match ? match[1] : '';
};
