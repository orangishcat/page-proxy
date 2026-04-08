import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const pageProxyPrismDarkTheme = {
  plain: {
    color: "#e7e8ea",
    backgroundColor: "#282824",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: { color: "#93a1a1", fontStyle: "italic" },
    },
    {
      types: ["punctuation", "delimiter", "delimiter.bracket"],
      style: { color: "#999999" },
    },
    {
      types: ["operator"],
      style: { color: "#a67f59" },
    },
    {
      types: ["number", "boolean"],
      style: { color: "#ee9900" },
    },
    {
      types: ["string", "char", "attr-value", "regex"],
      style: { color: "#669900" },
    },
    {
      types: ["keyword", "atrule"],
      style: { color: "#ff8f3f" },
    },
    {
      types: ["function", "method", "entity", "entity.name.function", "support.function"],
      style: { color: "#fcb253" },
    },
    {
      types: ["class-name", "builtin", "type", "type.identifier", "namespace", "tag", "attr-name"],
      style: { color: "#59c2ff" },
    },
    {
      types: ["variable", "property", "constant", "symbol", "selector"],
      style: { color: "#efe2d4" },
    },
  ],
};

const pageProxyPrismLightTheme = {
  plain: {
    color: "#2b2c2a",
    backgroundColor: "#f2f3f2",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: { color: "#5e635e", fontStyle: "italic" },
    },
    {
      types: ["punctuation", "delimiter", "delimiter.bracket"],
      style: { color: "#787d78" },
    },
    {
      types: ["operator"],
      style: { color: "#8b6a49" },
    },
    {
      types: ["number", "boolean"],
      style: { color: "#c47b00" },
    },
    {
      types: ["string", "char", "attr-value", "regex"],
      style: { color: "#4a7429" },
    },
    {
      types: ["keyword", "atrule"],
      style: { color: "#cc7028" },
    },
    {
      types: ["function", "method", "entity", "entity.name.function", "support.function"],
      style: { color: "#b97723" },
    },
    {
      types: ["class-name", "builtin", "type", "type.identifier", "namespace", "tag", "attr-name"],
      style: { color: "#2f90c7" },
    },
    {
      types: ["variable", "property", "constant", "symbol", "selector"],
      style: { color: "#3d403d" },
    },
  ],
};

const config: Config = {
  title: "Page Proxy Docs",
  tagline: "Documentation for the pp library",
  favicon: "img/logo_filled.avif",
  url: process.env.NODE_ENV === "development" ? "http://localhost:3288" : "https://orangishcat.github.io",
  baseUrl: "/page-proxy/docs/",
  organizationName: "orangishcat",
  projectName: "page-proxy",
  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          includeCurrentVersion: false,
          lastVersion: "0.3.x",
          versions: {
            "0.3.x": {
              label: "v0.3.x",
            },
            "0.2.x": {
              label: "v0.2.x",
            },
            "0.1.x": {
              label: "v0.1.x",
            },
          },
        },
        blog: false,
        pages: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: {
      title: "Page Proxy",
      logo: {
        alt: "Page Proxy",
        src: "img/logo_filled.avif",
        href: "https://orangishcat.github.io/page-proxy",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          label: "Documentation",
          position: "left",
        },
        {
          type: "docsVersionDropdown",
          position: "right",
        },
      ],
    },
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    prism: {
      theme: pageProxyPrismLightTheme,
      darkTheme: pageProxyPrismDarkTheme,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
