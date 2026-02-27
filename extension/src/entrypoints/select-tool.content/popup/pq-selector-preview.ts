import { pq } from "@page-proxy/pp";
import { readBaseSelectorFromCode } from "./base-selector";

export type SelectorPreviewState = {
  matchingElements: Element[];
  error: string | null;
};

const selectorCallPattern = /pq\.selector\s*\(/;
const invalidSelectorError = "Selector is invalid.";
const missingSelectorError = "Selector definition must include pq.selector.";
const noMatchesError = "Selector matches no elements.";

const extractFirstSelectorDefinitionSource = (code: string): string | null => {
  const selectorMatch = selectorCallPattern.exec(code);
  if (!selectorMatch) {
    return null;
  }

  let index = selectorMatch.index + selectorMatch[0].length;
  while (index < code.length && /\s/.test(code[index])) {
    index += 1;
  }

  if (code[index] !== "{") {
    return null;
  }

  const objectStart = index;
  let objectDepth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let cursor = objectStart; cursor < code.length; cursor += 1) {
    const current = code[cursor];
    const next = cursor + 1 < code.length ? code[cursor + 1] : "";

    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        cursor += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (current === "\\") {
        escaped = true;
        continue;
      }
      if (current === quote) {
        quote = null;
      }
      continue;
    }

    if (current === "/" && next === "/") {
      inLineComment = true;
      cursor += 1;
      continue;
    }
    if (current === "/" && next === "*") {
      inBlockComment = true;
      cursor += 1;
      continue;
    }
    if (current === "'" || current === '"' || current === "`") {
      quote = current;
      continue;
    }

    if (current === "{") {
      objectDepth += 1;
      continue;
    }

    if (current === "}") {
      objectDepth -= 1;
      if (objectDepth === 0) {
        return code.slice(objectStart, cursor + 1);
      }
    }
  }

  return null;
};

type SelectorDefinitionCandidate = {
  name?: unknown;
  baseSelector?: unknown;
  matches?: unknown;
};

const evaluateSelectorDefinition = (source: string): SelectorDefinitionCandidate | null => {
  try {
    const evaluator = new Function("pq", `"use strict"; return (${source});`);
    const result = evaluator(pq);
    if (!result || typeof result !== "object") {
      return null;
    }
    return result as SelectorDefinitionCandidate;
  } catch {
    return null;
  }
};

const buildPreviewSelectorDefinition = (candidate: SelectorDefinitionCandidate): pq.SelectorDefinition<Element> | null => {
  if (typeof candidate.matches !== "function") {
    return null;
  }

  const name = typeof candidate.name === "string" && candidate.name.trim().length > 0 ? candidate.name : "Selector preview";
  const baseSelector = typeof candidate.baseSelector === "string" ? candidate.baseSelector : undefined;
  const matches = candidate.matches as (element: Element) => unknown;

  return {
    name,
    ...(baseSelector !== undefined ? { baseSelector } : {}),
    matches: (element: Element) => Boolean(matches(element)),
  };
};

const buildFallbackPreviewSelectorDefinition = (code: string): pq.SelectorDefinition<Element> | null => {
  const baseSelector = readBaseSelectorFromCode(code)?.trim();
  if (!baseSelector) {
    return null;
  }

  return {
    name: "Selector preview",
    baseSelector,
    matches: () => true,
  };
};

export const getPqSelectorPreviewState = (
  code: string,
  excludedAncestorSelector = ".pp-no-select-tool",
): SelectorPreviewState => {
  const selectorDefinitionSource = extractFirstSelectorDefinitionSource(code);
  if (!selectorDefinitionSource) {
    return { matchingElements: [], error: missingSelectorError };
  }

  const selectorDefinitionCandidate = evaluateSelectorDefinition(selectorDefinitionSource);
  const evaluatedPreviewSelectorDefinition = selectorDefinitionCandidate
    ? buildPreviewSelectorDefinition(selectorDefinitionCandidate)
    : null;
  const previewSelectorDefinition = evaluatedPreviewSelectorDefinition ?? buildFallbackPreviewSelectorDefinition(code);
  if (!previewSelectorDefinition) {
    return { matchingElements: [], error: invalidSelectorError };
  }

  try {
    const matchingElements = pq
      .selector(previewSelectorDefinition)
      .queryAll()
      .filter((element) => !element.closest(excludedAncestorSelector));

    if (matchingElements.length === 0) {
      return { matchingElements, error: noMatchesError };
    }

    return { matchingElements, error: null };
  } catch {
    return { matchingElements: [], error: invalidSelectorError };
  }
};
