import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Page Proxy Docs",
  tagline: "Documentation for the pp library",
  favicon: "img/logo_filled.png",
  url: "https://orangishcat.github.io",
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
          includeCurrentVersion: true,
          lastVersion: "0.1.0",
          versions: {
            current: {
              label: "next",
              path: "next",
            },
            "0.1.0": {
              label: "v0.1.0",
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
        src: "img/logo_filled.png",
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
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
