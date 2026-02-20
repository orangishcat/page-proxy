import { parseCssSelectorParts } from "../css-inspector";

export const readSelectorSourceFromCssEditor = (value: string) => {
  const braceIndex = value.indexOf("{");
  if (braceIndex < 0) {
    return value;
  }
  return value.slice(0, braceIndex);
};

export const readTrimmedSelectorSourceFromCssEditor = (value: string) => readSelectorSourceFromCssEditor(value).trim();

export const readDeclarationSourceFromCssEditor = (value: string) => {
  const startBrace = value.indexOf("{");
  if (startBrace < 0) {
    return "";
  }
  const endBrace = value.lastIndexOf("}");
  const end = endBrace > startBrace ? endBrace : value.length;
  return value.slice(startBrace + 1, end).trim();
};

export const formatSelectorPartsMultiline = (selector: string) => {
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
