import { parse } from "acorn";
import { normalizeScriptMetadataWebsites, parseScriptMetadata } from "@/lib/utils/script-metadata";

export type ExportFormat = "pp-script" | "tampermonkey" | "css-only" | "wxt-extension";

export type ExportCompatibility = {
  tampermonkey: { ok: boolean; reason?: string };
  cssOnly: { ok: boolean; reason?: string };
};

export type ExportArtifact = {
  ok: true;
  fileName: string;
  mimeType: string;
  body: string;
};

export type ExportError = {
  ok: false;
  message: string;
};

export const hostedPpUserscriptRequireUrl = "https://orangishcat.github.io/page-proxy/pp/pp.min.js";

const pageProxyMetadataBlockPattern = /\/\/\s*==\s*Page\s*Proxy\s*==[\s\S]*?\/\/\s*==\s*\/\s*Page\s*Proxy\s*==/m;
const ppImportLinePattern = /^import\s*\{[^}]+\}\s*from\s*["']@page-proxy\/pp["'];?\s*$/gm;
const emptySelectorBlockPattern =
  /^\s*\/\/\s*==Selectors==\s*\n\s*\/\/\s*==\/Selectors==\s*(?:\n|$)/m;

type ParsedProgram = {
  body: unknown[];
};

type ImportDeclarationNode = {
  type: "ImportDeclaration";
  source?: { value?: unknown };
};

type ExportDeclarationNode = {
  type:
    | "ExportAllDeclaration"
    | "ExportDefaultDeclaration"
    | "ExportNamedDeclaration";
};

type ExpressionStatementNode = {
  type: "ExpressionStatement";
  expression?: unknown;
};

type CallExpressionNode = {
  type: "CallExpression";
  arguments?: unknown[];
  callee?: {
    type?: string;
    computed?: boolean;
    object?: { type?: string; name?: string };
    property?: { type?: string; name?: string };
  };
};

type StaticInjectCssCall = {
  cssText: string;
};

const parseJavaScriptModule = (source: string) =>
  parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as ParsedProgram;

const slugifyFileStem = (title: string) => {
  const normalized = (title.trim() || "page-proxy-script")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "page-proxy-script";
};

const toSingleLineMetadataValue = (value: string) => value.trim().replace(/\s+/g, " ");

const readStaticStringValue = (value: unknown): string | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const node = value as {
    type?: string;
    value?: unknown;
    expressions?: unknown[];
    quasis?: Array<{ value?: { cooked?: string | null; raw?: string } }>;
  };

  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }

  if (node.type === "TemplateLiteral" && (node.expressions?.length ?? 0) === 0) {
    const quasi = node.quasis?.[0];
    return quasi?.value?.cooked ?? quasi?.value?.raw ?? null;
  }

  return null;
};

const isPpImportDeclaration = (statement: unknown): statement is ImportDeclarationNode => {
  if (!statement || typeof statement !== "object") {
    return false;
  }

  const node = statement as ImportDeclarationNode;
  return node.type === "ImportDeclaration" && node.source?.value === "@page-proxy/pp";
};

const isExportDeclaration = (statement: unknown): statement is ExportDeclarationNode => {
  if (!statement || typeof statement !== "object") {
    return false;
  }

  const node = statement as ExportDeclarationNode;
  return (
    node.type === "ExportAllDeclaration" ||
    node.type === "ExportDefaultDeclaration" ||
    node.type === "ExportNamedDeclaration"
  );
};

const readStaticInjectCssCall = (statement: unknown): StaticInjectCssCall | null => {
  if (!statement || typeof statement !== "object") {
    return null;
  }

  const expressionStatement = statement as ExpressionStatementNode;
  if (expressionStatement.type !== "ExpressionStatement" || !expressionStatement.expression) {
    return null;
  }

  const callExpression = expressionStatement.expression as CallExpressionNode;
  if (
    callExpression.type !== "CallExpression" ||
    callExpression.callee?.type !== "MemberExpression" ||
    callExpression.callee.computed === true ||
    callExpression.callee.object?.type !== "Identifier" ||
    callExpression.callee.object.name !== "ps" ||
    callExpression.callee.property?.type !== "Identifier" ||
    callExpression.callee.property.name !== "injectCSS"
  ) {
    return null;
  }

  const args = callExpression.arguments ?? [];
  if (args.length !== 1) {
    return {
      cssText: "",
    };
  }

  const cssText = readStaticStringValue(args[0]);
  if (cssText === null) {
    return {
      cssText: "",
    };
  }

  return {
    cssText,
  };
};

const analyzeCssOnlyStatements = (body: unknown[]) => {
  const cssBlocks: string[] = [];

  for (const statement of body) {
    if (isPpImportDeclaration(statement)) {
      continue;
    }

    if (isExportDeclaration(statement)) {
      return {
        ok: false,
        reason: "CSS-only export only supports scripts that contain static ps.injectCSS calls and no module exports.",
      } as const;
    }

    const injectCall = readStaticInjectCssCall(statement);
    if (!injectCall) {
      return {
        ok: false,
        reason: "CSS-only export only supports scripts that contain static ps.injectCSS calls and no other executable code.",
      } as const;
    }

    if (!injectCall.cssText.trim()) {
      const expressionStatement = statement as ExpressionStatementNode;
      const args = ((expressionStatement.expression as CallExpressionNode).arguments ?? []).length;
      return {
        ok: false,
        reason:
          args !== 1
            ? "CSS-only export does not support ps.injectCSS options."
            : "CSS-only export only supports static ps.injectCSS template strings.",
      } as const;
    }

    cssBlocks.push(injectCall.cssText.trim());
  }

  if (cssBlocks.length === 0) {
    return {
      ok: false,
      reason: "CSS-only export only supports scripts that contain static ps.injectCSS calls.",
    } as const;
  }

  return {
    ok: true,
    cssBlocks,
  } as const;
};

const analyzeTampermonkeyStatements = (body: unknown[]) => {
  for (const statement of body) {
    if (isPpImportDeclaration(statement)) {
      continue;
    }

    if (!statement || typeof statement !== "object") {
      continue;
    }

    const node = statement as { type?: string };
    if (node.type === "ImportDeclaration") {
      return {
        ok: false,
        reason: "Tampermonkey export only supports the built-in @page-proxy/pp import scaffold.",
      } as const;
    }

    if (isExportDeclaration(statement)) {
      return {
        ok: false,
        reason: "Tampermonkey export does not support ES module exports.",
      } as const;
    }
  }

  return { ok: true } as const;
};

const getParsedBody = (content: string) => {
  try {
    return parseJavaScriptModule(content).body;
  } catch {
    return null;
  }
};

const buildUserscriptMetadataHeader = (content: string) => {
  const metadata = parseScriptMetadata(content);
  const websiteValues = metadata.websites.length > 0 ? metadata.websites : [metadata.website];
  const websiteDirectives = buildUserscriptWebsiteDirectives(websiteValues);
  const lines = [
    "// ==UserScript==",
    `// @name ${toSingleLineMetadataValue(metadata.title)}`,
    ...websiteDirectives,
    `// @description ${toSingleLineMetadataValue(metadata.description)}`,
  ];

  if (metadata.author.trim()) {
    lines.push(`// @author ${toSingleLineMetadataValue(metadata.author)}`);
  }

  if (metadata.grants.includes("run-on-page-load")) {
    lines.push("// @run-at document-start");
  }

  lines.push(`// @require ${hostedPpUserscriptRequireUrl}`);
  lines.push("// ==/UserScript==");
  return {
    header: lines.join("\n"),
    title: metadata.title,
  };
};

const stripPpImportLines = (content: string) => content.replace(ppImportLinePattern, "").replace(/^\s*\n/, "");

const stripEmptySelectorBlock = (content: string) => content.replace(emptySelectorBlockPattern, "");

const replacePageProxyMetadataWithUserscriptHeader = (content: string, header: string) => {
  if (!pageProxyMetadataBlockPattern.test(content)) {
    throw new Error("Missing Page Proxy metadata block.");
  }

  return content.replace(pageProxyMetadataBlockPattern, header);
};

export const isUserscriptMatchPattern = (value: string) => /^(?:\*|https?):\/\/[^/\s]+\/.*$/.test(value.trim());

export const buildUserscriptWebsiteDirectives = (websites: string[]) =>
  websites
    .map((website) => website.trim())
    .filter((website) => website.length > 0)
    .map((website) => `// ${isUserscriptMatchPattern(website) ? "@match" : "@include"} ${website}`);

export const analyzeExportCompatibility = (content: string): ExportCompatibility => {
  const body = getParsedBody(content);
  if (!body) {
    return {
      tampermonkey: {
        ok: false,
        reason: "Tampermonkey export requires valid JavaScript.",
      },
      cssOnly: {
        ok: false,
        reason: "CSS-only export requires valid JavaScript.",
      },
    };
  }

  const tampermonkey = analyzeTampermonkeyStatements(body);
  const cssOnly = analyzeCssOnlyStatements(body);

  return {
    tampermonkey: tampermonkey.ok ? { ok: true } : tampermonkey,
    cssOnly: cssOnly.ok ? { ok: true } : cssOnly,
  };
};

export const buildPpScriptExport = (content: string): ExportArtifact | ExportError => {
  try {
    const normalizedContent = normalizeScriptMetadataWebsites(content);
    const metadata = parseScriptMetadata(normalizedContent);
    const fileStem = slugifyFileStem(metadata.title);
    return {
      ok: true,
      fileName: `${fileStem}.js`,
      mimeType: "text/javascript;charset=utf-8",
      body: normalizedContent,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to export script.",
    };
  }
};

export const buildTampermonkeyExport = (content: string): ExportArtifact | ExportError => {
  const compatibility = analyzeExportCompatibility(content);
  if (!compatibility.tampermonkey.ok) {
    return {
      ok: false,
      message: compatibility.tampermonkey.reason ?? "Tampermonkey export is not supported for this script.",
    };
  }

  try {
    const normalizedContent = normalizeScriptMetadataWebsites(content);
    const { header, title } = buildUserscriptMetadataHeader(normalizedContent);
    const body = stripEmptySelectorBlock(
      stripPpImportLines(replacePageProxyMetadataWithUserscriptHeader(normalizedContent, header)),
    ).trim();

    return {
      ok: true,
      fileName: `${slugifyFileStem(title)}.user.js`,
      mimeType: "text/javascript;charset=utf-8",
      body: `${body}\n`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to export Tampermonkey userscript.",
    };
  }
};

export const buildCssOnlyExport = (content: string): ExportArtifact | ExportError => {
  const compatibility = analyzeExportCompatibility(content);
  if (!compatibility.cssOnly.ok) {
    return {
      ok: false,
      message: compatibility.cssOnly.reason ?? "CSS-only export is not supported for this script.",
    };
  }

  try {
    const metadata = parseScriptMetadata(content);
    const cssBlocks = analyzeCssOnlyStatements(parseJavaScriptModule(content).body);
    if (!cssBlocks.ok) {
      return {
        ok: false,
        message: cssBlocks.reason,
      };
    }

    return {
      ok: true,
      fileName: `${slugifyFileStem(metadata.title)}.css`,
      mimeType: "text/css;charset=utf-8",
      body: cssBlocks.cssBlocks.join("\n\n"),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to export CSS-only stylesheet.",
    };
  }
};
