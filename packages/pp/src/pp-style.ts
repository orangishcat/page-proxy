import * as css from "css-tree";
import { selector as createSelector, selectorMatches } from "./pp-query";

export type StyleValues = Record<string, string>;
export type StyleTarget = Element | Element[];
export type InjectCssPriority = "normal" | "high" | "xhigh";
export type InjectCssOptions = {
  priority?: InjectCssPriority;
};

const psHashAttributeName = "data-ps-hash";
const psStylePriorityAttributeName = "data-ps-priority";
const psXHighPriorityAttributeName = "data-ps-xhigh";

const hashCssString = (value: string) => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
};

const defaultInjectCssPriority: InjectCssPriority = "high";

const normalizeInjectCssPriority = (priority?: InjectCssPriority): InjectCssPriority =>
  priority ?? defaultInjectCssPriority;

const toStyleSheetPriority = (priority: InjectCssPriority): Exclude<InjectCssPriority, "xhigh"> =>
  priority === "normal" ? "normal" : "high";

const getPriorityRank = (priority: Exclude<InjectCssPriority, "xhigh">) => (priority === "high" ? 1 : 0);

const hasHigherStyleSheetPriority = (
  requestedPriority: Exclude<InjectCssPriority, "xhigh">,
  existingPriority: Exclude<InjectCssPriority, "xhigh">,
) => getPriorityRank(requestedPriority) > getPriorityRank(existingPriority);

const splitTopLevelSelectorList = (value: string) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return [];
  }

  const ast = css.parse(trimmedValue, { context: "selectorList" });
  if (ast.type !== "SelectorList") {
    return [trimmedValue];
  }

  return ast.children.toArray().map((selectorNode) => css.generate(selectorNode));
};

const isStyleRule = (rule: CSSRule): rule is CSSRule & { selectorText: string; style: CSSStyleDeclaration } =>
  "selectorText" in rule && "style" in rule;

const isNestedRule = (rule: CSSRule): rule is CSSRule & { cssRules: CSSRuleList; cssText: string } =>
  "cssRules" in rule && "cssText" in rule;

const isStyleElement = (element: Element | null): element is HTMLStyleElement =>
  Boolean(element && element.tagName === "STYLE");

const toInjectedStyleText = (styleText: string, priority: Exclude<InjectCssPriority, "xhigh">) => {
  if (priority === "normal") {
    return styleText;
  }

  const ast = css.parse(styleText);
  css.walk(ast, {
    visit: "Declaration",
    enter(node) {
      if (node.type === "Declaration") {
        node.important = true;
      }
    },
  });
  return css.generate(ast);
};

const getStoredStyleSheetPriority = (styleElement: HTMLStyleElement): Exclude<InjectCssPriority, "xhigh"> => {
  const value = styleElement.getAttribute(psStylePriorityAttributeName);
  return value === "normal" ? "normal" : "high";
};

const createStyleElement = (hash: string, styleText: string, priority: Exclude<InjectCssPriority, "xhigh">) => {
  const styleElement = document.createElement("style");
  styleElement.setAttribute(psHashAttributeName, hash);
  styleElement.setAttribute(psStylePriorityAttributeName, priority);
  styleElement.textContent = toInjectedStyleText(styleText, priority);
  document.head.appendChild(styleElement);
  return styleElement;
};

const updateStyleElementPriority = (
  styleElement: HTMLStyleElement,
  styleText: string,
  priority: Exclude<InjectCssPriority, "xhigh">,
) => {
  styleElement.setAttribute(psStylePriorityAttributeName, priority);
  styleElement.textContent = toInjectedStyleText(styleText, priority);
};

const toInlineDeclarations = (style: CSSStyleDeclaration) =>
  Array.from(style).map((propertyName) => ({
    name: propertyName,
    value: style.getPropertyValue(propertyName).trim(),
  }));

const applyInlineDeclarations = (
  element: HTMLElement | SVGElement,
  declarations: Array<{ name: string; value: string }>,
) => {
  declarations.forEach(({ name, value }) => {
    element.style.setProperty(name, value, "important");
  });
};

const enhanceStyleRuleWithXHighPriority = (
  selectorText: string,
  declarations: Array<{ name: string; value: string }>,
) => {
  const selectors = splitTopLevelSelectorList(selectorText).filter(
    (selectorTextPart) => !selectorTextPart.includes("::"),
  );

  selectors.forEach((selectorTextPart) => {
    const selectorQuery = createSelector({
      name: selectorTextPart,
      baseSelector: selectorTextPart,
      matches: (element: Element) => selectorMatches(element, selectorTextPart),
    });

    selectorQuery.onElementMatches((element) => {
      if ("style" in element) {
        applyInlineDeclarations(element as HTMLElement | SVGElement, declarations);
      }
    });
  });
};

const installXHighPriorityEnhancement = (styleElement: HTMLStyleElement) => {
  const sheet = styleElement.sheet;
  if (!sheet) {
    return false;
  }

  const applyRuleList = (rules: CSSRuleList) => {
    Array.from(rules).forEach((rule) => {
      if (isStyleRule(rule)) {
        const declarations = toInlineDeclarations(rule.style).filter(({ value }) => value.length > 0);
        if (declarations.length > 0) {
          enhanceStyleRuleWithXHighPriority(rule.selectorText, declarations);
        }
        return;
      }

      if (isNestedRule(rule)) {
        applyRuleList(rule.cssRules);
      }
    });
  };

  applyRuleList(sheet.cssRules);
  styleElement.setAttribute(psXHighPriorityAttributeName, "true");
  return true;
};

export const applyStyle = (elements: StyleTarget, values: StyleValues) => {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return;
  }

  const targetElements = Array.isArray(elements) ? elements : [elements];

  targetElements.forEach((element) => {
    if (!("style" in element)) {
      throw new Error("Element has no style property");
    }

    const styledElement = element as HTMLElement | SVGElement;
    entries.forEach(([key, value]) => {
      if (value.includes("!important")) {
        styledElement.style.setProperty(key, value.replace("!important", ""), "important");
      } else {
        styledElement.style.setProperty(key, value);
      }
    });
  });
};

export const injectCSS = (styleText: string, options: InjectCssOptions = {}) => {
  if (styleText.trim().length === 0) {
    return false;
  }

  const head = document.head;
  if (!head) {
    return false;
  }

  const priority = normalizeInjectCssPriority(options.priority);
  const styleSheetPriority = toStyleSheetPriority(priority);
  const hash = hashCssString(styleText);
  const existingStyle = head.querySelector(`style[${psHashAttributeName}="${hash}"]`);
  const styleElement = isStyleElement(existingStyle)
    ? existingStyle
    : createStyleElement(hash, styleText, styleSheetPriority);
  let changed = !isStyleElement(existingStyle);

  if (isStyleElement(existingStyle)) {
    const existingPriority = getStoredStyleSheetPriority(existingStyle);
    if (hasHigherStyleSheetPriority(styleSheetPriority, existingPriority)) {
      updateStyleElementPriority(existingStyle, styleText, styleSheetPriority);
      changed = true;
    }
  }

  if (priority === "xhigh" && styleElement.getAttribute(psXHighPriorityAttributeName) !== "true") {
    changed = installXHighPriorityEnhancement(styleElement) || changed;
  }

  return changed;
};
