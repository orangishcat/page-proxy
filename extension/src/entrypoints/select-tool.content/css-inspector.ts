import type { FilterOperator } from "./preview-code";

export type CssSelectorPartType =
  | "tag"
  | "class"
  | "id"
  | "attribute"
  | "pseudo"
  | "combinator"
  | "descendant"
  | "group"
  | "wildcard";

export type CssSelectorPart = {
  id: string;
  text: string;
  displayText: string;
  type: CssSelectorPartType;
  description: string;
  key: string | null;
  value: string | null;
  startOffset: number;
  endOffset: number;
};

const selectorTokenPattern =
  /\[[^\]]+\]|::?[a-zA-Z-]+(?:\([^)]*\))?|[#.][a-zA-Z0-9_-]+|\*|[a-zA-Z][a-zA-Z0-9_-]*|[>+~]|,|\s+/g;

const attributePattern = /^\[\s*([^\s~|^$*=\]]+)(?:\s*[~|^$*]?=\s*["']?([^"'`\]]+)["']?)?\s*\]$/;

const parsePseudoToken = (token: string) => {
  const isPseudoElement = token.startsWith("::");
  const withoutPrefix = token.replace(/^::?/, "");
  const openIndex = withoutPrefix.indexOf("(");
  const hasFunctionArgs = openIndex >= 0 && withoutPrefix.endsWith(")");
  const pseudoName = (hasFunctionArgs ? withoutPrefix.slice(0, openIndex) : withoutPrefix).toLowerCase();
  const pseudoArgs = hasFunctionArgs ? withoutPrefix.slice(openIndex + 1, -1).trim() : null;
  return { isPseudoElement, pseudoName, pseudoArgs };
};

const describePseudo = (token: string) => {
  const { isPseudoElement, pseudoName, pseudoArgs } = parsePseudoToken(token);

  if (isPseudoElement) {
    if (pseudoName === "before") {
      return "Targets the generated content inserted before an element.";
    }
    if (pseudoName === "after") {
      return "Targets the generated content inserted after an element.";
    }
    if (pseudoName === "first-letter") {
      return "Targets only the first letter of an element's text.";
    }
    if (pseudoName === "first-line") {
      return "Targets only the first formatted line of text.";
    }
    if (pseudoName === "selection") {
      return "Targets the portion of text currently selected by the user.";
    }
    if (pseudoName === "placeholder") {
      return "Targets placeholder text inside form controls.";
    }
    if (pseudoName === "marker") {
      return "Targets list-item marker boxes (like bullets or numbers).";
    }
    if (pseudoName === "backdrop") {
      return "Targets the backdrop layer (for example, behind dialogs).";
    }
    if (pseudoName === "file-selector-button") {
      return 'Targets the button portion of <input type="file">.';
    }
    return `Targets the ::${pseudoName} pseudo-element.`;
  }

  if (pseudoName === "hover") {
    return "Matches while the pointer is over the element.";
  }
  if (pseudoName === "active") {
    return "Matches while the element is being activated (for example, mouse down).";
  }
  if (pseudoName === "focus") {
    return "Matches while the element has focus.";
  }
  if (pseudoName === "focus-visible") {
    return "Matches focused elements when the browser decides focus should be visibly indicated.";
  }
  if (pseudoName === "focus-within") {
    return "Matches an element if it or any descendant currently has focus.";
  }
  if (pseudoName === "visited") {
    return "Matches links that the user has already visited.";
  }
  if (pseudoName === "link") {
    return "Matches links that have not yet been visited.";
  }
  if (pseudoName === "target") {
    return "Matches the element referenced by the URL fragment (#...).";
  }
  if (pseudoName === "root") {
    return "Matches the document root element (<html> in HTML documents).";
  }
  if (pseudoName === "empty") {
    return "Matches elements with no child nodes (including no text).";
  }
  if (pseudoName === "checked") {
    return "Matches checked checkboxes/radios and selected <option> elements.";
  }
  if (pseudoName === "disabled") {
    return "Matches disabled form controls.";
  }
  if (pseudoName === "enabled") {
    return "Matches enabled form controls.";
  }
  if (pseudoName === "required") {
    return "Matches form controls that require a value.";
  }
  if (pseudoName === "optional") {
    return "Matches form controls that do not require a value.";
  }
  if (pseudoName === "valid") {
    return "Matches form controls whose current value passes validation.";
  }
  if (pseudoName === "invalid") {
    return "Matches form controls whose current value fails validation.";
  }
  if (pseudoName === "read-only") {
    return "Matches controls that are not editable by the user.";
  }
  if (pseudoName === "read-write") {
    return "Matches controls that are editable by the user.";
  }
  if (pseudoName === "in-range") {
    return "Matches controls whose value is within min/max constraints.";
  }
  if (pseudoName === "out-of-range") {
    return "Matches controls whose value is outside min/max constraints.";
  }
  if (pseudoName === "first-child") {
    return "Matches elements that are the first child of their parent.";
  }
  if (pseudoName === "last-child") {
    return "Matches elements that are the last child of their parent.";
  }
  if (pseudoName === "only-child") {
    return "Matches elements that are the only child of their parent.";
  }
  if (pseudoName === "first-of-type") {
    return "Matches the first sibling of its element type.";
  }
  if (pseudoName === "last-of-type") {
    return "Matches the last sibling of its element type.";
  }
  if (pseudoName === "only-of-type") {
    return "Matches when it is the only sibling of its element type.";
  }
  if (pseudoName === "nth-child") {
    return `Matches elements whose sibling index fits :nth-child(${pseudoArgs || "..."}).`;
  }
  if (pseudoName === "nth-last-child") {
    return `Matches elements by index from the end via :nth-last-child(${pseudoArgs || "..."}).`;
  }
  if (pseudoName === "nth-of-type") {
    return `Matches siblings of the same type using :nth-of-type(${pseudoArgs || "..."}).`;
  }
  if (pseudoName === "nth-last-of-type") {
    return `Matches siblings of the same type from the end using :nth-last-of-type(${pseudoArgs || "..."}).`;
  }
  if (pseudoName === "not") {
    return `Excludes elements matching :not(${pseudoArgs || "..."}).`;
  }
  if (pseudoName === "is") {
    return `Matches if any selector in :is(${pseudoArgs || "..."}) matches.`;
  }
  if (pseudoName === "where") {
    return `Matches like :is(), but :where(${pseudoArgs || "..."}) adds zero specificity.`;
  }
  if (pseudoName === "has") {
    return `Matches elements that contain/relate to descendants matching :has(${pseudoArgs || "..."}).`;
  }

  return `Hmm, I don't know about this psuedo-selector.`;
};

const buildDescription = (type: CssSelectorPartType, text: string, key: string | null, value: string | null) => {
  if (type === "tag") {
    return `Matches <${text}> elements.`;
  }
  if (type === "class") {
    return `Matches elements with class "${value ?? text.slice(1)}".`;
  }
  if (type === "id") {
    return `Matches the element with id "${value ?? text.slice(1)}".`;
  }
  if (type === "attribute") {
    if (value !== null) {
      return `Matches elements where ${key} uses value "${value}".`;
    }
    return `Matches elements where ${key} exists.`;
  }
  if (type === "pseudo") {
    return describePseudo(text);
  }
  if (type === "combinator") {
    if (text === ">") {
      return "Selects direct children only.";
    }
    if (text === "+") {
      return "Selects the next adjacent sibling.";
    }
    if (text === "~") {
      return "Selects following siblings.";
    }
    return "Combines selector parts.";
  }
  if (type === "descendant") {
    return "Selects descendants at any depth (space combinator).";
  }
  if (type === "group") {
    return "Separates grouped selectors.";
  }
  return "Matches any element.";
};

const parseToken = (token: string) => {
  if (/^\s+$/.test(token)) {
    return {
      text: " ",
      displayText: "descendant (space)",
      type: "descendant" as const,
      key: null,
      value: null,
    };
  }

  if (token === ",") {
    return {
      text: token,
      displayText: token,
      type: "group" as const,
      key: null,
      value: null,
    };
  }

  if (token === "*") {
    return {
      text: token,
      displayText: token,
      type: "wildcard" as const,
      key: null,
      value: null,
    };
  }

  if (token === ">" || token === "+" || token === "~") {
    return {
      text: token,
      displayText: token,
      type: "combinator" as const,
      key: null,
      value: null,
    };
  }

  if (token.startsWith(".")) {
    const className = token.slice(1);
    return {
      text: token,
      displayText: token,
      type: "class" as const,
      key: "class",
      value: className,
    };
  }

  if (token.startsWith("#")) {
    const idValue = token.slice(1);
    return {
      text: token,
      displayText: token,
      type: "id" as const,
      key: "id",
      value: idValue,
    };
  }

  if (token.startsWith("[")) {
    const attributeMatch = token.match(attributePattern);
    return {
      text: token,
      displayText: token,
      type: "attribute" as const,
      key: attributeMatch?.[1] ?? null,
      value: attributeMatch?.[2] ?? null,
    };
  }

  if (token.startsWith(":")) {
    return {
      text: token,
      displayText: token,
      type: "pseudo" as const,
      key: null,
      value: null,
    };
  }

  return {
    text: token,
    displayText: token,
    type: "tag" as const,
    key: "tag",
    value: token,
  };
};

export const parseCssSelectorParts = (selector: string): CssSelectorPart[] => {
  if (!selector.trim()) {
    return [];
  }

  const parts: CssSelectorPart[] = [];
  const matches = selector.matchAll(selectorTokenPattern);

  for (const [index, match] of Array.from(matches).entries()) {
    const token = match[0];
    const parsed = parseToken(token);
    const tokenStartOffset = match.index ?? 0;
    const tokenEndOffset = tokenStartOffset + token.length;
    parts.push({
      id: `${index}-${parsed.type}`,
      text: parsed.text,
      displayText: parsed.displayText,
      type: parsed.type,
      key: parsed.key,
      value: parsed.value,
      description: buildDescription(parsed.type, parsed.text, parsed.key, parsed.value),
      startOffset: tokenStartOffset,
      endOffset: tokenEndOffset,
    });
  }

  return parts;
};

const buildAttributeSnippet = (part: CssSelectorPart, operator: FilterOperator) => {
  const key = part.key;
  const value = part.value;

  if (!key) {
    return part.text;
  }
  if (operator === "keyExists") {
    return `[${key}]`;
  }
  if (!value) {
    return `[${key}]`;
  }
  if (operator === "contains") {
    return `[${key}*="${value}"]`;
  }
  return `[${key}="${value}"]`;
};

export const buildCssSelectorSnippet = (part: CssSelectorPart | null, operator: FilterOperator) => {
  if (!part) {
    return '[data-key="value"]';
  }

  if (part.type === "class") {
    if (operator === "contains") {
      return `[class*="${part.value ?? ""}"]`;
    }
    if (operator === "keyExists") {
      return "[class]";
    }
    return part.text;
  }

  if (part.type === "id") {
    if (operator === "contains") {
      return `[id*="${part.value ?? ""}"]`;
    }
    if (operator === "keyExists") {
      return "[id]";
    }
    return part.text;
  }

  if (part.type === "attribute") {
    return buildAttributeSnippet(part, operator);
  }

  if (part.type === "group") {
    return ",";
  }

  if (part.type === "descendant") {
    return " ";
  }

  return part.text;
};

const needsDirectAppend = (snippet: string) => /^[.#[:]/.test(snippet);

export const appendSnippetToSelector = (baseSelector: string, snippet: string) => {
  const base = baseSelector.trim();
  const normalizedSnippet = snippet === " " ? " " : snippet.trim();

  if (!normalizedSnippet && snippet !== " ") {
    return base;
  }
  if (!base) {
    return normalizedSnippet;
  }
  if (normalizedSnippet === " ") {
    return `${base} `;
  }
  if (
    normalizedSnippet === "," ||
    normalizedSnippet === ">" ||
    normalizedSnippet === "+" ||
    normalizedSnippet === "~"
  ) {
    return `${base} ${normalizedSnippet} `;
  }
  if (base.endsWith(",") || base.endsWith(">") || base.endsWith("+") || base.endsWith("~")) {
    return `${base} ${normalizedSnippet}`;
  }
  if (needsDirectAppend(normalizedSnippet)) {
    return `${base}${normalizedSnippet}`;
  }
  return `${base} ${normalizedSnippet}`;
};
