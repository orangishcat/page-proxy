import { parseCssSelectorParts } from "./css-inspector";

export type ParsedCssDeclaration = {
  key: string;
  value: string;
  order: number;
};

const cssDeclarationPattern = /^([a-zA-Z-][\w-]*)\s*:\s*(.+?)\s*;?$/;

export const readSelectorSourceFromCssEditor = (value: string) => {
  const braceIndex = value.indexOf("{");
  if (braceIndex < 0) {
    return value;
  }
  return value.slice(0, braceIndex);
};

const readTrimmedSelectorSourceFromCssEditor = (value: string) => readSelectorSourceFromCssEditor(value).trim();

export const readDeclarationSourceFromCssEditor = (value: string) => {
  const startBrace = value.indexOf("{");
  if (startBrace < 0) {
    return "";
  }
  const endBrace = value.lastIndexOf("}");
  const end = endBrace > startBrace ? endBrace : value.length;
  return value.slice(startBrace + 1, end).trim();
};

const formatSelectorPartsMultiline = (selector: string) => {
  const parts = parseCssSelectorParts(selector);
  if (parts.length === 0) {
    return "";
  }

  const lines: string[] = [];
  let currentLine = "";

  parts.forEach((part) => {
    if (part.type === "descendant") {
      if (currentLine.length > 0 && !currentLine.endsWith(" ")) {
        currentLine = `${currentLine} `;
      }
      return;
    }

    if (part.type === "group") {
      if (currentLine.trim().length > 0) {
        lines.push(`${currentLine.trimEnd()},`);
        currentLine = "";
        return;
      }
      if (lines.length > 0) {
        lines[lines.length - 1] = `${lines[lines.length - 1].trimEnd()},`;
        return;
      }
      lines.push(",");
      return;
    }

    if (part.type === "combinator") {
      if (currentLine.trim().length === 0) {
        return;
      }
      lines.push(`${currentLine.trimEnd()} ${part.text}`);
      currentLine = "";
      return;
    }

    if (currentLine.length === 0) {
      currentLine = part.text;
      return;
    }

    const attachesDirectly =
      part.type === "class" || part.type === "id" || part.type === "attribute" || part.type === "pseudo";
    if (attachesDirectly) {
      currentLine = `${currentLine.trimEnd()}${part.text}`;
      return;
    }

    if (currentLine.endsWith(" ")) {
      currentLine = `${currentLine}${part.text}`;
      return;
    }

    currentLine = `${currentLine.trimEnd()} ${part.text}`;
  });

  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trimEnd());
  }

  return lines.join("\n");
};

export const normalizeSelectorFromCssEditor = (value: string) => {
  const selectorSource = readTrimmedSelectorSourceFromCssEditor(value);
  const parts = parseCssSelectorParts(selectorSource);
  if (parts.length === 0) {
    return "";
  }

  let result = "";
  let sawWhitespace = false;

  parts.forEach((part) => {
    if (part.type === "descendant") {
      sawWhitespace = true;
      return;
    }

    if (part.type === "group") {
      result = `${result.trimEnd()}, `;
      sawWhitespace = false;
      return;
    }

    if (part.type === "combinator") {
      result = `${result.trimEnd()} ${part.text} `;
      sawWhitespace = false;
      return;
    }

    if (result.length === 0) {
      result = part.text;
      sawWhitespace = false;
      return;
    }

    const attachesDirectly =
      part.type === "class" || part.type === "id" || part.type === "attribute" || part.type === "pseudo";
    const trimmedResult = result.trimEnd();
    const lastChar = trimmedResult[trimmedResult.length - 1] ?? "";
    const isAfterCombinator = lastChar === ">" || lastChar === "+" || lastChar === "~" || lastChar === ",";

    if (attachesDirectly && !isAfterCombinator) {
      result = `${trimmedResult}${part.text}`;
    } else if (sawWhitespace && !isAfterCombinator) {
      result = `${trimmedResult} ${part.text}`;
    } else if (isAfterCombinator) {
      result = `${trimmedResult} ${part.text}`;
    } else {
      result = `${trimmedResult} ${part.text}`;
    }

    sawWhitespace = false;
  });

  return result.trim();
};

export const buildCssDocument = (selector: string, declarations: string) => {
  const formattedSelector = formatSelectorPartsMultiline(selector);
  const selectorSection = formattedSelector.length > 0 ? formattedSelector : selector.trim();
  const declarationLines = declarations
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const declarationSection =
    declarationLines.length > 0 ? declarationLines.map((line) => `  ${line}`).join("\n") : "  ";

  return `${selectorSection}\n{\n${declarationSection}\n}`;
};

export const buildInjectCssSnippet = (selector: string, declarations: string) => {
  const cssDocument = buildCssDocument(selector, declarations);
  return `ps.injectCSS(\`\n${cssDocument}\n\`);`;
};

const readDefaultComputedStyleValueMap = (sourceElement: Element) => {
  const targetTagName =
    sourceElement instanceof HTMLElement && sourceElement.tagName.length > 0
      ? sourceElement.tagName.toLowerCase()
      : "div";
  const host = document.body ?? document.documentElement;
  if (!host) {
    return new Map<string, string>();
  }

  const dummyElement = document.createElement(targetTagName);
  dummyElement.classList.add("pp-no-select-tool");
  dummyElement.setAttribute("aria-hidden", "true");
  dummyElement.style.position = "fixed";
  dummyElement.style.left = "-9999px";
  dummyElement.style.top = "-9999px";
  dummyElement.style.visibility = "hidden";
  dummyElement.style.pointerEvents = "none";
  host.appendChild(dummyElement);

  const defaultComputedStyle = getComputedStyle(dummyElement);
  const defaultValues = new Map<string, string>();
  for (let index = 0; index < defaultComputedStyle.length; index += 1) {
    const key = defaultComputedStyle.item(index);
    if (!key) {
      continue;
    }
    defaultValues.set(key, defaultComputedStyle.getPropertyValue(key).trim());
  }

  dummyElement.remove();
  return defaultValues;
};

export const readComputedStyleEntries = (element: Element | null) => {
  if (!element?.isConnected) {
    return [] as Array<{ key: string; value: string; originalOrder: number }>;
  }

  const defaultValues = readDefaultComputedStyleValueMap(element);
  const computedStyle = getComputedStyle(element);
  const entries: Array<{ key: string; value: string; originalOrder: number }> = [];

  for (let index = 0; index < computedStyle.length; index += 1) {
    const key = computedStyle.item(index);
    if (!key) {
      continue;
    }
    const value = computedStyle.getPropertyValue(key).trim();
    const defaultValue = defaultValues.get(key) ?? "";
    if (value === defaultValue) {
      continue;
    }
    entries.push({
      key,
      value,
      originalOrder: index,
    });
  }

  return entries;
};

export const parseCssDeclarations = (declarations: string): ParsedCssDeclaration[] => {
  return declarations
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, order) => {
      const match = line.match(cssDeclarationPattern);
      if (!match) {
        return null;
      }
      return {
        key: match[1].toLowerCase(),
        value: match[2].trim(),
        order,
      } satisfies ParsedCssDeclaration;
    })
    .filter((entry): entry is ParsedCssDeclaration => entry !== null);
};

const serializeCssDeclarations = (declarations: ParsedCssDeclaration[]) =>
  declarations.map((declaration) => `${declaration.key}: ${declaration.value};`).join("\n");

export const upsertCssDeclaration = (declarations: string, key: string, value: string) => {
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey) {
    return declarations;
  }

  const parsed = parseCssDeclarations(declarations);
  const existingIndex = parsed.findIndex((entry) => entry.key === normalizedKey);
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    if (existingIndex >= 0) {
      parsed.splice(existingIndex, 1);
    }
    return serializeCssDeclarations(parsed);
  }

  if (existingIndex >= 0) {
    parsed[existingIndex] = { ...parsed[existingIndex], value: trimmedValue };
    return serializeCssDeclarations(parsed);
  }

  return serializeCssDeclarations([
    ...parsed,
    {
      key: normalizedKey,
      value: trimmedValue,
      order: parsed.length,
    },
  ]);
};

export const removeCssDeclaration = (declarations: string, key: string) => {
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey) {
    return declarations;
  }
  const parsed = parseCssDeclarations(declarations).filter((entry) => entry.key !== normalizedKey);
  return serializeCssDeclarations(parsed);
};
