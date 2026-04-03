export const siteName = "Page Proxy";
export const siteAuthor = "orangishcat";
export const siteUrl = "https://orangishcat.github.io/page-proxy/";
export const siteLocale = "en_US";
export const siteDescription =
  "Page Proxy is a browser extension and userscript manager for Chrome and Firefox with GUI tools, recording workflows, and a built-in Monaco editor.";
export const defaultSocialImagePath = "/social-preview.png";
export const defaultSocialImageAlt = "Page Proxy showing a customized web page and userscript workflow.";
export const indexedPaths = ["/", "/install"] as const;

export type JsonLdEntry = Record<string, unknown>;

type WebPageJsonLdOptions = {
  description: string;
  path: string;
  title?: string;
};

export function createAbsoluteUrl(path = "/"): string {
  const normalizedPath = !path || path === "/" ? "" : path.replace(/^\//, "");
  return new URL(normalizedPath, siteUrl).toString();
}

export function createTitle(title?: string): string {
  if (!title || title === siteName) {
    return siteName;
  }

  return `${title} | ${siteName}`;
}

export function buildSitemapXml(paths: readonly string[]): string {
  const urls = paths
    .map((path) => `  <url>\n    <loc>${createAbsoluteUrl(path)}</loc>\n  </url>`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
  ].join("\n");
}

export function buildRobotsTxt(): string {
  return ["User-agent: *", "Allow: /", "", `Sitemap: ${createAbsoluteUrl("/sitemap.xml")}`].join("\n");
}

export function createWebsiteJsonLd(): JsonLdEntry {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description: siteDescription,
    inLanguage: "en",
    name: siteName,
    publisher: {
      "@type": "Person",
      name: siteAuthor,
    },
    url: createAbsoluteUrl("/"),
  };
}

export function createSoftwareApplicationJsonLd(version: string): JsonLdEntry {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    applicationCategory: "BrowserApplication",
    author: {
      "@type": "Person",
      name: siteAuthor,
    },
    description: siteDescription,
    downloadUrl: createAbsoluteUrl("/install"),
    image: createAbsoluteUrl(defaultSocialImagePath),
    name: siteName,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    operatingSystem: "Chrome, Firefox, Chromium-based browsers",
    softwareVersion: version,
    url: createAbsoluteUrl("/"),
  };
}

export function createWebPageJsonLd({ description, path, title }: WebPageJsonLdOptions): JsonLdEntry {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    description,
    inLanguage: "en",
    isPartOf: {
      "@type": "WebSite",
      name: siteName,
      url: createAbsoluteUrl("/"),
    },
    name: createTitle(title),
    url: createAbsoluteUrl(path),
  };
}

export function createInstallHowToJsonLd(version: string): JsonLdEntry {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    description: `Install Page Proxy version ${version} in Chrome or Firefox from the latest GitHub release.`,
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: "0",
    },
    image: createAbsoluteUrl(defaultSocialImagePath),
    name: "Install Page Proxy",
    step: [
      {
        "@type": "HowToStep",
        name: "Choose your browser",
        text: "Select whether you want to install Page Proxy in Chrome or Firefox.",
      },
      {
        "@type": "HowToStep",
        name: "Download the latest release",
        text: "Download the latest Chrome or Firefox package from the Page Proxy GitHub releases page.",
      },
      {
        "@type": "HowToStep",
        name: "Open your browser extension page",
        text: "Open chrome://extensions or Firefox's add-ons page and enable the developer installation flow if needed.",
      },
      {
        "@type": "HowToStep",
        name: "Load the extension",
        text: "Use the load unpacked or install from file flow to finish installing Page Proxy.",
      },
    ],
    totalTime: "PT5M",
  };
}
