import { parse } from "acorn";
import { simple } from "acorn-walk";

export type PqSelectorDefinitionBlock = {
  code: string;
  start: number;
  end: number;
  variableName: string;
  definitionName: string | null;
};

const parseJavaScript = (source: string) => {
  return parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
  });
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

const readSelectorDefinitionName = (value: unknown): string | null => {
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

    if (readPropertyKey(property.key) !== "name") {
      continue;
    }

    return readStaticStringValue(property.value);
  }

  return null;
};

export const extractPqSelectorDefinitionBlocks = (source: string): PqSelectorDefinitionBlock[] => {
  try {
    const ast = parseJavaScript(source);
    const blocks: PqSelectorDefinitionBlock[] = [];

    simple(ast, {
      VariableDeclaration(node) {
        if (node.kind !== "const" || node.declarations.length !== 1) {
          return;
        }

        const declaration = node.declarations[0];
        if (declaration.id.type !== "Identifier" || !isPqSelectorCall(declaration.init)) {
          return;
        }

        blocks.push({
          code: source.slice(node.start, node.end),
          start: node.start,
          end: node.end,
          variableName: declaration.id.name,
          definitionName: readSelectorDefinitionName(declaration.init.arguments[0]),
        });
      },
    });

    return blocks;
  } catch {
    return [];
  }
};

export const findPqSelectorDefinitionBlockByName = (source: string, definitionName: string) => {
  const normalizedName = definitionName.trim();
  if (!normalizedName) {
    return null;
  }

  return (
    extractPqSelectorDefinitionBlocks(source).find((block) => block.definitionName?.trim() === normalizedName) ?? null
  );
};

export const findPqSelectorDefinitionBlockByVariableName = (source: string, variableName: string) => {
  const normalizedName = variableName.trim();
  if (!normalizedName) {
    return null;
  }

  return extractPqSelectorDefinitionBlocks(source).find((block) => block.variableName === normalizedName) ?? null;
};
