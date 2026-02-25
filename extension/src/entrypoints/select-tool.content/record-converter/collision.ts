type ResolveRecordConverterCollisionsArgs = {
  code: string;
  existingCode: string;
};

type ResolveRecordConverterCollisionsResult = {
  finalCode: string;
  renameMap: Record<string, string>;
};

const identifierPattern = /\b[A-Za-z_$][A-Za-z0-9_$]*\b/g;
const declarationPattern = /\b(?:const|let|var|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g;

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

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const collectIdentifiers = (source: string) => {
  const identifiers = new Set<string>();
  for (const match of source.matchAll(identifierPattern)) {
    const identifier = match[0];
    if (!reservedIdentifiers.has(identifier)) {
      identifiers.add(identifier);
    }
  }
  return identifiers;
};

const collectDeclaredIdentifiers = (source: string) => {
  const identifiers: string[] = [];
  const seen = new Set<string>();
  for (const match of source.matchAll(declarationPattern)) {
    const identifier = match[1];
    if (!identifier || seen.has(identifier) || reservedIdentifiers.has(identifier)) {
      continue;
    }
    seen.add(identifier);
    identifiers.push(identifier);
  }
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

  const finalCode = Object.entries(renameMap).reduce((currentCode, [identifier, nextIdentifier]) => {
    const pattern = new RegExp(`\\b${escapeForRegex(identifier)}\\b`, "g");
    return currentCode.replace(pattern, nextIdentifier);
  }, code);

  return {
    finalCode,
    renameMap,
  };
};
