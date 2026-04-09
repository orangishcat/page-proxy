import { describe, expect, test } from "bun:test";
import {
  analyzeExportCompatibility,
  buildCssOnlyExport,
  buildPpScriptExport,
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

const runnableScript = `import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";

// ==Page Proxy==
// @title Runtime Script
// @website https://example.com/*
// @description Shows a notification
// @author Tim
// @grant run-on-page-load
// ==/Page Proxy==

// ==Selectors==
// ==/Selectors==

const total = 1 + 2;
pa.notification(\`Total: \${total}\`);
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
  test("builds a userscript header with @require and strips Page Proxy scaffolding", async () => {
    const result = await buildTampermonkeyExport(staticCssScript, { minify: false });

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

  test("preserves the userscript header while minifying the executable body", async () => {
    const result = await buildTampermonkeyExport(runnableScript, { minify: true });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful minified Tampermonkey export");
    }

    const [header, body] = result.body.split("// ==/UserScript==\n");
    expect(header).toContain("// ==UserScript==");
    expect(body).toContain('pa.notification("Total: 3");');
    expect(body).not.toContain("const total = 1 + 2;");
  });
});

describe("buildCssOnlyExport", () => {
  test("concatenates static CSS blocks in source order", () => {
    const result = buildCssOnlyExport(staticCssScript, { minify: false });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful CSS-only export");
    }

    expect(result.fileName).toBe("theme-tweak.css");
    expect(result.mimeType).toBe("text/css;charset=utf-8");
    expect(result.body).toBe("header {\n  color: red;\n}\n\nmain {\n  color: blue;\n}");
  });

  test("minifies CSS-only exports when requested", () => {
    const result = buildCssOnlyExport(staticCssScript, { minify: true });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful minified CSS export");
    }

    expect(result.body).toBe("header{color:red}main{color:#00f}");
  });
});

describe("buildPpScriptExport", () => {
  test("preserves metadata and selector markers while minifying runtime code", async () => {
    const result = await buildPpScriptExport(runnableScript, { minify: true });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful minified Page Proxy export");
    }

    expect(result.body).toContain("// ==Page Proxy==");
    expect(result.body).toContain("// ==/Page Proxy==");
    expect(result.body).toContain("// ==Selectors==");
    expect(result.body).toContain("// ==/Selectors==");
    expect(result.body).toContain('pa.notification("Total: 3");');
    expect(result.body).not.toContain("const total = 1 + 2;");
  });
});
