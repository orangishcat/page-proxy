import * as acorn from "acorn";
import { full as walkFull, simple as walkSimple } from "acorn-walk";

type ResolveRecordConverterCollisionsArgs = {
  code: string;
  existingCode: string;
};

type ResolveRecordConverterCollisionsResult = {
  finalCode: string;
  renameMap: Record<string, string>;
};

const reservedIdentifiers = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

const parseAst = (source: string) => {
  try {
    return acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  } catch {
    return null;
  }
};

const collectIdentifiers = (source: string) => {
  const identifiers = new Set<string>();
  const ast = parseAst(source);
  if (!ast) return identifiers;
  walkFull(ast, (node) => {
    if (node.type === "Identifier" && !reservedIdentifiers.has(node.name)) {
      identifiers.add(node.name);
    }
  });
  return identifiers;
};

const collectDeclaredIdentifiers = (source: string) => {
  const identifiers: string[] = [];
  const seen = new Set<string>();
  const ast = parseAst(source);
  if (!ast) return identifiers;

  const push = (name: string) => {
    if (!seen.has(name) && !reservedIdentifiers.has(name)) {
      seen.add(name);
      identifiers.push(name);
    }
  };

  walkSimple(ast, {
    VariableDeclarator(node) {
      if (node.id.type === "Identifier") push(node.id.name);
    },
    FunctionDeclaration(node) {
      if (node.id) push(node.id.name);
    },
    ClassDeclaration(node) {
      if (node.id) push(node.id.name);
    },
  });

  return identifiers;
};

const findNextIdentifier = (baseIdentifier: string, occupied: Set<string>) => {
  const match = baseIdentifier.match(/^(.*?)(\d+)?$/);
  const identifierStem = match?.[1] && match[1].length > 0 ? match[1] : baseIdentifier;
  const trailingNumber = match?.[2] ? Number.parseInt(match[2], 10) : Number.NaN;
  let suffix = Number.isFinite(trailingNumber) ? trailingNumber + 1 : 2;
  while (true) {
    const candidate = `${identifierStem}${suffix}`;
    if (!occupied.has(candidate) && !reservedIdentifiers.has(candidate)) {
      return candidate;
    }
    suffix += 1;
  }
};

const buildParentMap = (ast: acorn.Node) => {
  const parentMap = new WeakMap<acorn.Node, acorn.Node>();

  const visit = (value: unknown, parent: acorn.Node | null) => {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, parent));
      return;
    }

    if (!("type" in value) || typeof value.type !== "string") {
      return;
    }

    const node = value as acorn.Node;
    if (parent) {
      parentMap.set(node, parent);
    }

    Object.values(node).forEach((child) => visit(child, node));
  };

  visit(ast, null);
  return parentMap;
};

const shouldRenameIdentifier = (node: acorn.Node & { type: string; name?: string }, parent: acorn.Node | undefined) => {
  if (!parent) {
    return true;
  }

  const parentNode = parent as acorn.Node & {
    computed?: boolean;
    key?: acorn.Node;
    label?: acorn.Node | null;
    property?: acorn.Node;
    shorthand?: boolean;
  };

  if (
    (parentNode.type === "MemberExpression" && parentNode.property === node && !parentNode.computed) ||
    (parentNode.type === "Property" && parentNode.key === node && !parentNode.computed && !parentNode.shorthand) ||
    ((parentNode.type === "MethodDefinition" || parentNode.type === "PropertyDefinition") &&
      parentNode.key === node &&
      !parentNode.computed) ||
    (parentNode.type === "LabeledStatement" && parentNode.label === node) ||
    ((parentNode.type === "BreakStatement" || parentNode.type === "ContinueStatement") && parentNode.label === node)
  ) {
    return false;
  }

  return true;
};

const applyRenameMap = (source: string, renameMap: Record<string, string>) => {
  if (Object.keys(renameMap).length === 0) {
    return source;
  }

  const ast = parseAst(source);
  if (!ast) {
    return source;
  }
  const parentMap = buildParentMap(ast);

  const replacements: Array<{ start: number; end: number; value: string }> = [];

  walkFull(ast, (node) => {
    if (node.type !== "Identifier") {
      return;
    }

    const nextIdentifier = renameMap[node.name];
    if (!nextIdentifier) {
      return;
    }

    const parent = parentMap.get(node);
    if (!shouldRenameIdentifier(node, parent)) {
      return;
    }

    replacements.push({
      start: node.start,
      end: node.end,
      value: nextIdentifier,
    });
  });

  replacements.sort((left, right) => right.start - left.start);

  return replacements.reduce(
    (currentSource, replacement) =>
      `${currentSource.slice(0, replacement.start)}${replacement.value}${currentSource.slice(replacement.end)}`,
    source,
  );
};

export const resolveRecordConverterCollisions = ({
  code,
  existingCode,
}: ResolveRecordConverterCollisionsArgs): ResolveRecordConverterCollisionsResult => {
  if (code.trim().length === 0) {
    return {
      finalCode: code,
      renameMap: {},
    };
  }

  const existingIdentifiers = collectIdentifiers(existingCode);
  const declaredIdentifiers = collectDeclaredIdentifiers(code);
  const occupied = new Set<string>([...existingIdentifiers]);
  const renameMap: Record<string, string> = {};

  declaredIdentifiers.forEach((identifier) => {
    if (!occupied.has(identifier)) {
      occupied.add(identifier);
      return;
    }

    const nextIdentifier = findNextIdentifier(identifier, occupied);
    renameMap[identifier] = nextIdentifier;
    occupied.add(nextIdentifier);
  });

  const finalCode = applyRenameMap(code, renameMap);

  return {
    finalCode,
    renameMap,
  };
};
