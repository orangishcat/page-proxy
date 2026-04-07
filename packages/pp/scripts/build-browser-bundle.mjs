import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const workspaceDir = path.resolve(packageDir, "..", "..");
const entryFile = path.resolve(packageDir, "src/index.ts");

export const defaultPpBrowserBundleOutputFile = path.resolve(workspaceDir, "web/static/pp/pp.min.js");

export const buildPpBrowserBundle = async (options = {}) => {
  const outfile = options.outfile ? path.resolve(options.outfile) : defaultPpBrowserBundleOutputFile;
  mkdirSync(path.dirname(outfile), { recursive: true });

  await build({
    entryPoints: [entryFile],
    outfile,
    bundle: true,
    format: "iife",
    globalName: "PageProxyPpRuntime",
    minify: true,
    platform: "browser",
    target: "es2020",
    banner: {
      js: "globalThis.PageProxyPpRuntime = globalThis.PageProxyPpRuntime || {};",
    },
    footer: {
      js: [
        "globalThis.pa = PageProxyPpRuntime.pa;",
        "globalThis.pn = PageProxyPpRuntime.pn;",
        "globalThis.pq = PageProxyPpRuntime.pq;",
        "globalThis.ps = PageProxyPpRuntime.ps;",
        "globalThis.pt = PageProxyPpRuntime.pt;",
        "globalThis.pv = PageProxyPpRuntime.pv;",
        "globalThis.pp = PageProxyPpRuntime.pp;",
      ].join(""),
    },
  });

  return outfile;
};

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  await buildPpBrowserBundle();
}
