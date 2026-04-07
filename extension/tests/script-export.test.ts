import { describe, expect, test } from "bun:test";
import {
  analyzeExportCompatibility,
  buildCssOnlyExport,
  buildTampermonkeyExport,
  hostedPpUserscriptRequireUrl,
} from "../src/lib/script-export";

const staticCssScript = `import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";

// ==Page Proxy==
// @title Theme Tweak
// @website https://example.com/*
// https://*.example.com/*
// @description Restyles the page
// @author Tim
// @grant run-on-page-load
// ==/Page Proxy==

// ==Selectors==
// ==/Selectors==

ps.injectCSS(\`
header {
  color: red;
}
\`);

ps.injectCSS(\`
main {
  color: blue;
}
\`);
`;

describe("analyzeExportCompatibility", () => {
  test("accepts standard Page Proxy scripts for Tampermonkey export", () => {
    const compatibility = analyzeExportCompatibility(staticCssScript);

    expect(compatibility.tampermonkey).toEqual({ ok: true });
  });

  test("marks CSS-only export compatible when the script only contains static ps.injectCSS calls", () => {
    const compatibility = analyzeExportCompatibility(staticCssScript);

    expect(compatibility.cssOnly).toEqual({ ok: true });
  });

  test("marks CSS-only export incompatible when executable code remains", () => {
    const compatibility = analyzeExportCompatibility(`${staticCssScript}\npa.notification("hello");\n`);

    expect(compatibility.cssOnly.ok).toBe(false);
    expect(compatibility.cssOnly.reason).toContain("only supports scripts that contain static ps.injectCSS");
  });

  test("marks CSS-only export incompatible when ps.injectCSS uses options", () => {
    const compatibility = analyzeExportCompatibility(`// ==Page Proxy==
// @title Theme Tweak
// @website https://example.com/*
// @description Restyles the page
// ==/Page Proxy==

ps.injectCSS(\`header { color: red; }\`, { priority: "xhigh" });
`);

    expect(compatibility.cssOnly.ok).toBe(false);
    expect(compatibility.cssOnly.reason).toContain("options");
  });

  test("marks CSS-only export incompatible when ps.injectCSS is dynamic", () => {
    const compatibility = analyzeExportCompatibility(`// ==Page Proxy==
// @title Theme Tweak
// @website https://example.com/*
// @description Restyles the page
// ==/Page Proxy==

const color = "red";
ps.injectCSS(\`header { color: \${color}; }\`);
`);

    expect(compatibility.cssOnly.ok).toBe(false);
    expect(compatibility.cssOnly.reason).toContain("static");
  });
});

describe("buildTampermonkeyExport", () => {
  test("builds a userscript header with @require and strips Page Proxy scaffolding", () => {
    const result = buildTampermonkeyExport(staticCssScript);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful Tampermonkey export");
    }

    expect(result.fileName).toBe("theme-tweak.user.js");
    expect(result.mimeType).toBe("text/javascript;charset=utf-8");
    expect(result.body).toContain("// ==UserScript==");
    expect(result.body).toContain("// @name Theme Tweak");
    expect(result.body).toContain(`// @require ${hostedPpUserscriptRequireUrl}`);
    expect(result.body).toContain("// @run-at document-start");
    expect(result.body).toContain("// @match https://example.com/*");
    expect(result.body).toContain("// @match https://*.example.com/*");
    expect(result.body).not.toContain('import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";');
    expect(result.body).not.toContain("// ==Selectors==");
    expect(result.body).toContain("ps.injectCSS(`");
  });
});

describe("buildCssOnlyExport", () => {
  test("concatenates static CSS blocks in source order", () => {
    const result = buildCssOnlyExport(staticCssScript);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful CSS-only export");
    }

    expect(result.fileName).toBe("theme-tweak.css");
    expect(result.mimeType).toBe("text/css;charset=utf-8");
    expect(result.body).toBe("header {\n  color: red;\n}\n\nmain {\n  color: blue;\n}");
  });
});
