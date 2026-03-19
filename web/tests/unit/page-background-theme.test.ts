import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tailwindConfig = require("../../tailwind.config.cjs");

describe("page background theme", () => {
  test("defines a shared page canvas color token", () => {
    expect(tailwindConfig.theme.extend.colors.page).toEqual({
      light: "#f2f3f2",
      DEFAULT: "#282824",
    });
  });

  test("applies the shared page token to the global shell", () => {
    const appCss = readFileSync(new URL("../../src/app.css", import.meta.url), "utf8");
    const landingPage = readFileSync(new URL("../../src/routes/+page.svelte", import.meta.url), "utf8");
    const installPage = readFileSync(new URL("../../src/routes/install/+page.svelte", import.meta.url), "utf8");

    expect(appCss).toContain("bg-page-light");
    expect(appCss).toContain("dark:bg-page");

    expect(landingPage).toContain("bg-page-light");
    expect(landingPage).toContain("dark:bg-page");
    expect(landingPage).not.toContain("#282824");

    expect(installPage).toContain("bg-page-light");
    expect(installPage).toContain("dark:bg-page");
    expect(installPage).not.toContain("dark:bg-gray-950");
  });
});
