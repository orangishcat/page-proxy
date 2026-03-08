import { parse } from "acorn";
import { simple } from "acorn-walk";
import { buildCssBlock, parseCssRuleBlocks } from "./css-rule-parsing";

const maxSelectorRules = 24;

export type ParsedScriptSelectorEntry = {
  name: string;
  ruleKeys: string[];
  rules: string[];
  mode: "pp-api" | "css";
  cssText?: string;
};

type EntryWithPosition = ParsedScriptSelectorEntry & {
  start: number;
  order: number;
};

const parseJavaScript = (source: string) =>
  parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
  });

const normalizeRuleText = (value: string) => value.replace(/\s+/g, " ").trim();

const getRuleValues = (source: string, pattern: RegExp) =>
  Array.from(source.matchAll(pattern))
    .map((match) => normalizeRuleText(match[1] ?? ""))
    .filter((value) => value.length > 0);

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

const readPropertyKey = (value: unknown): string | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const node = value as {
    type?: string;
    name?: string;
    value?: unknown;
  };

  if (node.type === "Identifier" && typeof node.name === "string") {
    return node.name;
  }

  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }

  return null;
};

const isPqSelectorCall = (value: unknown): value is { arguments: unknown[] } => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const callExpression = value as {
    type?: string;
    callee?: {
      type?: string;
      computed?: boolean;
      object?: { type?: string; name?: string };
      property?: { type?: string; name?: string };
    };
    arguments?: unknown[];
  };

  return (
    callExpression.type === "CallExpression" &&
    callExpression.callee?.type === "MemberExpression" &&
    callExpression.callee.computed !== true &&
    callExpression.callee.object?.type === "Identifier" &&
    callExpression.callee.object.name === "pq" &&
    callExpression.callee.property?.type === "Identifier" &&
    callExpression.callee.property.name === "selector" &&
    Array.isArray(callExpression.arguments)
  );
};

const isPsInjectCssCall = (value: unknown): value is { arguments: unknown[]; start: number } => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const callExpression = value as {
    type?: string;
    start?: number;
    callee?: {
      type?: string;
      computed?: boolean;
      object?: { type?: string; name?: string };
      property?: { type?: string; name?: string };
    };
    arguments?: unknown[];
  };

  return (
    callExpression.type === "CallExpression" &&
    typeof callExpression.start === "number" &&
    callExpression.callee?.type === "MemberExpression" &&
    callExpression.callee.computed !== true &&
    callExpression.callee.object?.type === "Identifier" &&
    callExpression.callee.object.name === "ps" &&
    callExpression.callee.property?.type === "Identifier" &&
    callExpression.callee.property.name === "injectCSS" &&
    Array.isArray(callExpression.arguments)
  );
};

const readObjectPropertyValue = (value: unknown, propertyName: string) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const objectExpression = value as {
    type?: string;
    properties?: Array<{
      type?: string;
      computed?: boolean;
      key?: unknown;
      value?: unknown;
    }>;
  };

  if (objectExpression.type !== "ObjectExpression" || !Array.isArray(objectExpression.properties)) {
    return null;
  }

  for (const property of objectExpression.properties) {
    if (!property || property.type !== "Property" || property.computed === true) {
      continue;
    }

    if (readPropertyKey(property.key) === propertyName) {
      return property.value ?? null;
    }
  }

  return null;
};

const extractPqSelectorRules = (definition: unknown, source: string) => {
  const uniqueRules = new Set<string>();
  const pushRule = (rule: string) => {
    const normalizedRule = normalizeRuleText(rule);
    if (!normalizedRule || uniqueRules.size >= maxSelectorRules) {
      return;
    }

    uniqueRules.add(normalizedRule);
  };

  const baseSelector = readStaticStringValue(readObjectPropertyValue(definition, "baseSelector"));
  if (baseSelector?.trim()) {
    pushRule(`baseSelector: ${baseSelector.trim()}`);
  }

  const matchesNode = readObjectPropertyValue(definition, "matches");
  const matchesSource =
    matchesNode &&
    typeof matchesNode === "object" &&
    typeof (matchesNode as { start?: number }).start === "number" &&
    typeof (matchesNode as { end?: number }).end === "number"
      ? source.slice((matchesNode as { start: number }).start, (matchesNode as { end: number }).end)
      : "";

  getRuleValues(matchesSource, /pq\.(?:propMatches|propContains|propExists)\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/g).forEach(
    (propertyKey) => pushRule(propertyKey),
  );
  getRuleValues(matchesSource, /pq\.tagMatches\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/g).forEach((tag) =>
    pushRule(`tag: ${tag}`),
  );
  getRuleValues(matchesSource, /pq\.selectorMatches\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/g).forEach((selectorText) =>
    pushRule(`selector: ${selectorText}`),
  );

  if (matchesSource.includes("pq.bboxMatches(")) {
    pushRule("bbox");
  }

  if (matchesSource.includes("pq.innerTextMatches(")) {
    pushRule("innerText");
  }

  if (uniqueRules.size === 0) {
    pushRule("matches");
  }

  return Array.from(uniqueRules);
};

export const extractScriptSelectorEntries = (source: string): ParsedScriptSelectorEntry[] => {
  try {
    const ast = parseJavaScript(source);
    const entries: EntryWithPosition[] = [];
    let order = 0;

    simple(ast, {
      VariableDeclaration(node) {
        if (node.kind !== "const" || node.declarations.length !== 1) {
          return;
        }

        const declaration = node.declarations[0];
        if (declaration.id.type !== "Identifier" || !isPqSelectorCall(declaration.init)) {
          return;
        }

        const definition = declaration.init.arguments[0];
        const definitionName = readStaticStringValue(readObjectPropertyValue(definition, "name"));
        const name = definitionName?.trim() || "Unnamed selector";
        const rules = extractPqSelectorRules(definition, source);
        entries.push({
          name,
          ruleKeys: rules,
          rules,
          mode: "pp-api",
          start: node.start,
          order: order += 1,
        });
      },
      CallExpression(node) {
        if (!isPsInjectCssCall(node)) {
          return;
        }

        const styleText = readStaticStringValue(node.arguments[0]);
        if (!styleText?.trim()) {
          return;
        }

        let blocks: Array<{ selector: string; declarations: string }>;
        try {
          blocks = parseCssRuleBlocks(styleText);
        } catch {
          return;
        }

        blocks.forEach((block, blockIndex) => {
          entries.push({
            name: block.selector,
            ruleKeys: [`selector: ${block.selector}`],
            rules: [`selector: ${block.selector}`],
            mode: "css",
            cssText: buildCssBlock(block.selector, block.declarations),
            start: node.start + blockIndex,
            order: order += 1,
          });
        });
      },
    });

    return entries
      .sort((left, right) => left.start - right.start || left.order - right.order)
      .map(({ start: _start, order: _order, ...entry }) => entry);
  } catch {
    return [];
  }
};
