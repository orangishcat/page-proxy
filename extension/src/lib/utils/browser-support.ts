type BrowserKind = "chrome" | "brave" | "firefox" | "unsupported";

type BrowserSupport = {
  browser: BrowserKind;
  supported: boolean;
};

type NavigatorBrandEntry = {
  brand: string;
  version: string;
};

type NavigatorWithBrowserSignals = Navigator & {
  brave?: {
    isBrave?: () => Promise<boolean>;
  };
  userAgentData?: {
    brands?: NavigatorBrandEntry[];
  };
};

const chromiumForkTokens = [
  "Arc/",
  "Chromium/",
  "DuckDuckGo/",
  "Edg/",
  "Electron/",
  "OPR/",
  "SamsungBrowser/",
  "Vivaldi/",
  "YaBrowser/",
];

const firefoxForkTokens = [
  "Basilisk/",
  "Floorp/",
  "LibreWolf/",
  "PaleMoon/",
  "SeaMonkey/",
  "Waterfox/",
];

const includesAnyToken = (value: string, tokens: string[]) => tokens.some((token) => value.includes(token));

const getBrandNames = (navigatorObject: NavigatorWithBrowserSignals) =>
  navigatorObject.userAgentData?.brands?.map((brand) => brand.brand) ?? [];

const isBraveBrowser = async (navigatorObject: NavigatorWithBrowserSignals) => {
  if (typeof navigatorObject.brave?.isBrave !== "function") {
    return false;
  }

  return navigatorObject.brave.isBrave();
};

export const detectBrowserSupport = async (): Promise<BrowserSupport> => {
  if (typeof navigator === "undefined") {
    return { browser: "unsupported", supported: false };
  }

  const navigatorObject = navigator as NavigatorWithBrowserSignals;
  const userAgent = navigatorObject.userAgent;
  const brandNames = getBrandNames(navigatorObject);

  if (brandNames.includes("Brave")) {
    return { browser: "brave", supported: true };
  }

  if (brandNames.includes("Google Chrome")) {
    return { browser: "chrome", supported: true };
  }

  if (brandNames.includes("Firefox")) {
    return { browser: "firefox", supported: true };
  }

  const braveBrowser = await isBraveBrowser(navigatorObject);
  if (braveBrowser) {
    return { browser: "brave", supported: true };
  }

  const firefoxBrowser = userAgent.includes("Firefox/") && !includesAnyToken(userAgent, firefoxForkTokens);
  if (firefoxBrowser) {
    return { browser: "firefox", supported: true };
  }

  const chromeBrowser = userAgent.includes("Chrome/")
    && navigatorObject.vendor === "Google Inc."
    && !includesAnyToken(userAgent, chromiumForkTokens);

  if (chromeBrowser) {
    return { browser: "chrome", supported: true };
  }

  return { browser: "unsupported", supported: false };
};
