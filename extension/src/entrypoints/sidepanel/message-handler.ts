import type {
  RecordConverterSavePayload,
  RecordConverterSaveResult,
  SelectorSavePayload,
  SelectorSaveResult,
} from "@/lib/selection";
import { resolveRecordConverterCollisions } from "../select-tool.content/record-converter/collision";
import { type SelectorEntry, type ElementEntry, sanitizeVariableName } from "./tools/code-editor/state";

export type MessageHandlerDeps = {
  getSelectorEntries: () => SelectorEntry[];
  getElementEntries: () => ElementEntry[];
  getEditorContent: () => string;
  insertDefinitions: (lines: string[]) => boolean;
  setError: (message: string | null) => void;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const selectorDefinitionPattern = new RegExp(
  `\\bconst\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegExp("pq.selector")}\\s*\\(`,
);

const extractSelectorVariableName = (code: string): string | null => {
  const match = code.match(selectorDefinitionPattern);
  return match?.[1] ?? null;
};

export const saveSelectorDefinition = (
  payload: SelectorSavePayload,
  deps: MessageHandlerDeps,
): SelectorSaveResult => {
  const rawCode = payload.code.trim();
  const includesSelectorDefinition = rawCode.includes("pq.selector");
  const includesInjectCssCall = rawCode.includes("ps.injectCSS");

  if (includesInjectCssCall && !includesSelectorDefinition) {
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
