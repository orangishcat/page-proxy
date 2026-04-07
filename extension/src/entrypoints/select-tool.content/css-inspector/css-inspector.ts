import * as css from "css-tree";
import type { FilterOperator } from "../popup/selector/preview-code";

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

export const parseCssSelectorParts = (selector: string): CssSelectorPart[] => {
  if (!selector.trim()) return [];

  let ast: css.CssNode;
  try {
    ast = css.parse(selector, { context: "selectorList", positions: true });
  } catch {
    return [];
  }

  if (ast.type !== "SelectorList") return [];

  const parts: CssSelectorPart[] = [];
  let globalIndex = 0;

  const addPart = (
    text: string,
    displayText: string,
    type: CssSelectorPartType,
    key: string | null,
    value: string | null,
    startOffset: number,
    endOffset: number,
  ) => {
    parts.push({
      id: `${globalIndex++}-${type}`,
      text,
      displayText,
      type,
      key,
      value,
      description: buildDescription(type, text, key, value),
      startOffset,
      endOffset,
    });
  };

  const selectors = ast.children.toArray();
  selectors.forEach((selectorNode, selectorIndex) => {
    if (selectorIndex > 0) {
      const prevEnd = selectors[selectorIndex - 1].loc!.end.offset;
      addPart(",", ",", "group", null, null, prevEnd, prevEnd + 1);
    }

    if (selectorNode.type !== "Selector") return;
    selectorNode.children.forEach((node) => {
      const start = node.loc?.start.offset ?? 0;
      const end = node.loc?.end.offset ?? 0;
      const text = node.loc ? selector.slice(start, end) : "";

      if (node.type === "TypeSelector") {
        if (node.name === "*") {
          addPart(text, text, "wildcard", null, null, start, end);
        } else {
          addPart(text, text, "tag", "tag", node.name, start, end);
        }
      } else if (node.type === "ClassSelector") {
        addPart(text, text, "class", "class", node.name, start, end);
      } else if (node.type === "IdSelector") {
        addPart(text, text, "id", "id", node.name, start, end);
      } else if (node.type === "AttributeSelector") {
        const attrKey = node.name.name;
        const attrValue =
          node.value?.type === "String"
            ? node.value.value.replace(/^["']|["']$/g, "")
            : node.value?.type === "Identifier"
              ? node.value.name
              : null;
        addPart(text, text, "attribute", attrKey, attrValue, start, end);
      } else if (node.type === "PseudoClassSelector" || node.type === "PseudoElementSelector") {
        addPart(text, text, "pseudo", null, null, start, end);
      } else if (node.type === "Combinator") {
        if (node.name === " ") {
          addPart(" ", "descendant (space)", "descendant", null, null, start, end);
        } else {
          addPart(node.name, node.name, "combinator", null, null, start, end);
        }
      }
    });
  });

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
