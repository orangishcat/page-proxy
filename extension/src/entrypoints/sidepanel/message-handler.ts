import type {
  RecordConverterSavePayload,
  RecordConverterSaveResult,
  SelectorSavePayload,
  SelectorSaveResult,
} from "@/lib/selection";
import { normalizeSelector, parseCssRuleBlocksWithRanges } from "@/lib/utils/css-rule-parsing";
import { isRecord } from "@/lib/utils/type-guards";
import {
  extractPqSelectorDefinitionBlocks,
  findPqSelectorDefinitionBlockByVariableName,
} from "@/lib/utils/pq-selector-parsing";
import { resolveRecordConverterCollisions } from "../select-tool.content/record-converter/collision";
import { type SelectorEntry, type ElementEntry, sanitizeVariableName } from "./tools/code-editor/state";

export type MessageHandlerDeps = {
  getSelectorEntries: () => SelectorEntry[];
  getElementEntries: () => ElementEntry[];
  getEditorContent: () => string;
  insertDefinitions: (lines: string[]) => boolean;
  replaceEditorContent: (content: string) => boolean;
  setError: (message: string | null) => void;
};


export const isSelectorSaveMessage = (
  message: unknown,
): message is { type: "selector:save"; payload: SelectorSavePayload } => {
  if (!message || typeof message !== "object") return false;
  const payload = (message as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return false;
  return (message as { type?: string }).type === "selector:save";
};

export const isRecordConverterSaveMessage = (
  message: unknown,
): message is { type: "record:converter:save"; payload: RecordConverterSavePayload } => {
  if (!isRecord(message)) return false;
  if (message.type !== "record:converter:save") return false;
  const payload = message.payload;
  return isRecord(payload) && typeof payload.code === "string";
};

export const isApplyStyleSaveMessage = (
  message: unknown,
): message is { type: "selector:apply-style:save"; cssValues: Record<string, string> } => {
  if (!isRecord(message)) return false;
  if (message.type !== "selector:apply-style:save") return false;
  return isRecord(message.cssValues);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const selectorDefinitionPattern = new RegExp(
  `\\bconst\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegExp("pq.selector")}\\s*\\(`,
);

const extractSelectorVariableName = (code: string): string | null => {
  const match = code.match(selectorDefinitionPattern);
  return match?.[1] ?? null;
};

const replaceExactBlock = (content: string, originalCode: string, nextCode: string) => {
  const start = content.indexOf(originalCode);
  if (start < 0) {
    return null;
  }

  return `${content.slice(0, start)}${nextCode}${content.slice(start + originalCode.length)}`;
};

const extractCssDocumentFromSnippet = (code: string) => {
  const match = /ps\.injectCSS\s*\(\s*`([\s\S]*?)`\s*\)/.exec(code);
  return match?.[1] ?? null;
};

const readCssSelectorSource = (value: string) => {
  const braceIndex = value.indexOf("{");
  if (braceIndex < 0) {
    return value.trim();
  }
  return value.slice(0, braceIndex).trim();
};

const replaceCssRuleBlock = (content: string, originalSelector: string, nextCssDocument: string) => {
  const injectPattern = /ps\.injectCSS\s*\(\s*`([\s\S]*?)`\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = injectPattern.exec(content)) !== null) {
    const styleText = match[1];
    const styleTextOffset = match[0].indexOf(styleText);
    if (styleTextOffset < 0) {
      continue;
    }

    const matchingBlock = parseCssRuleBlocksWithRanges(styleText).find(
      (block) => normalizeSelector(block.selector) === normalizeSelector(originalSelector),
    );
    if (!matchingBlock) {
      continue;
    }

    const styleTextStart = match.index + styleTextOffset;
    const blockStart = styleTextStart + matchingBlock.start;
    const blockEnd = styleTextStart + matchingBlock.end;
    return `${content.slice(0, blockStart)}${nextCssDocument}${content.slice(blockEnd)}`;
  }

  return null;
};

const replaceExistingCssDefinition = (payload: SelectorSavePayload, content: string) => {
  const nextCssDocument = extractCssDocumentFromSnippet(payload.code.trim());
  if (!nextCssDocument) {
    return null;
  }

  const originalSelector = payload.originalCode ? readCssSelectorSource(payload.originalCode) : payload.baseSelector?.trim();
  if (!originalSelector) {
    return null;
  }

  return replaceCssRuleBlock(content, originalSelector, nextCssDocument);
};

const replaceExistingSelectorDefinition = (payload: SelectorSavePayload, content: string) => {
  const originalCode = payload.originalCode?.trim();
  const nextCode = payload.code.trim();
  if (!originalCode) {
    return null;
  }

  const exactReplacement = replaceExactBlock(content, originalCode, nextCode);
  if (exactReplacement !== null) {
    return exactReplacement;
  }

  const originalVariableName = extractSelectorVariableName(originalCode);
  if (!originalVariableName) {
    return null;
  }

  const currentBlock = findPqSelectorDefinitionBlockByVariableName(content, originalVariableName);
  if (!currentBlock) {
    return null;
  }

  return `${content.slice(0, currentBlock.start)}${nextCode}${content.slice(currentBlock.end)}`;
};

export const saveSelectorDefinition = (
  payload: SelectorSavePayload,
  deps: MessageHandlerDeps,
): SelectorSaveResult => {
  const rawCode = payload.code.trim();
  const existingCode = deps.getEditorContent();
  const includesSelectorDefinition = rawCode.includes("pq.selector");
  const includesInjectCssCall = rawCode.includes("ps.injectCSS");

  if (includesInjectCssCall && !includesSelectorDefinition) {
    const replacedContent = replaceExistingCssDefinition(payload, existingCode);
    if (replacedContent !== null) {
      if (!deps.replaceEditorContent(replacedContent)) {
        const error = "Unable to save selector to the editor.";
        deps.setError(error);
        return { ok: false, error };
      }
      deps.setError(null);
      return { ok: true };
    }

    if (!deps.insertDefinitions([rawCode])) {
      const error = "Unable to save selector to the editor.";
      deps.setError(error);
      return { ok: false, error };
    }
    deps.setError(null);
    return { ok: true };
  }

  if (!includesSelectorDefinition) {
    const error = "Selector definition must include pq.selector.";
    deps.setError(error);
    return { ok: false, error };
  }

  const existingVariableNames = new Set(
    [...deps.getElementEntries(), ...deps.getSelectorEntries()].map((entry) =>
      sanitizeVariableName(entry.name),
    ),
  );
  const originalVariableName = payload.originalCode
    ? extractPqSelectorDefinitionBlocks(payload.originalCode)[0]?.variableName ?? null
    : null;
  if (originalVariableName) {
    existingVariableNames.delete(sanitizeVariableName(originalVariableName));
  }

  const variableName = extractSelectorVariableName(rawCode);
  if (!variableName) {
    const error = "Selector definition must include a const assignment.";
    deps.setError(error);
    return { ok: false, error };
  }

  if (existingVariableNames.has(sanitizeVariableName(variableName))) {
    const error = `Variable name "${variableName}" already exists.`;
    deps.setError(error);
    return { ok: false, error };
  }

  const replacedContent = replaceExistingSelectorDefinition(payload, existingCode);
  if (replacedContent !== null) {
    if (!deps.replaceEditorContent(replacedContent)) {
      const error = "Unable to save selector to the editor.";
      deps.setError(error);
      return { ok: false, error };
    }
    deps.setError(null);
    return { ok: true };
  }

  if (!deps.insertDefinitions([rawCode])) {
    const error = "Unable to save selector to the editor.";
    deps.setError(error);
    return { ok: false, error };
  }

  deps.setError(null);
  return { ok: true };
};

export const saveRecordConverterDefinition = async (
  payload: RecordConverterSavePayload,
  deps: MessageHandlerDeps,
): Promise<RecordConverterSaveResult> => {
  const rawCode = payload.code.trim();
  if (!rawCode) {
    const error = "Record converter code is empty.";
    deps.setError(error);
    return { ok: false, error };
  }

  const existingCode = deps.getEditorContent();
  return Promise.resolve(resolveRecordConverterCollisions({ code: rawCode, existingCode }))
    .then(({ finalCode, renameMap }) => {
      if (!deps.insertDefinitions([finalCode])) {
        const error = "Unable to save record converter code.";
        deps.setError(error);
        return { ok: false, error };
      }
      deps.setError(null);
      return { ok: true, finalCode, renameMap };
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Unable to resolve record converter collisions.";
      deps.setError(message);
      return { ok: false, error: message };
    });
};
