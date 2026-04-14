import { z } from "zod";
import { buildDefaultRecordPanelState, type RecordPanelState } from "../../entrypoints/sidepanel/tools/storage/record-panel";
import {
  coerceStoredToolState,
  type StoredToolState,
} from "../stored-tool-state";

const coerceRecordTimelineEntry = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as {
    id?: unknown;
    action?: unknown;
    detail?: unknown;
    timestamp?: unknown;
  };

  if (
    typeof data.id !== "string" ||
    typeof data.action !== "string" ||
    typeof data.detail !== "string" ||
    typeof data.timestamp !== "number"
  ) {
    return null;
  }

  return {
    id: data.id,
    action: data.action,
    detail: data.detail,
    timestamp: data.timestamp,
  };
};

const coerceRecordPanelState = (value: unknown): RecordPanelState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as {
    isRecording?: unknown;
    timeline?: unknown;
    updatedAt?: unknown;
  };

  if (typeof data.isRecording !== "boolean") {
    return null;
  }

  const timeline = Array.isArray(data.timeline)
    ? data.timeline.map(coerceRecordTimelineEntry).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : [];

  return {
    isRecording: data.isRecording,
    timeline,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
  };
};

export const ScriptStorageEntrySchema = z
  .unknown()
  .transform((value): StoredToolState | null => coerceStoredToolState(value, ""))
  .refine((value): value is StoredToolState => value !== null);

export const ScriptStorageMapSchema = z.record(z.string().trim().min(1), z.unknown()).transform((record) => {
  const deduped = new Map<string, StoredToolState>();

  for (const [scriptName, value] of Object.entries(record)) {
    const state = coerceStoredToolState(value, scriptName);
    if (!state) {
      continue;
    }

    const existing = deduped.get(state.scriptName);
    if (!existing || state.updatedAt >= existing.updatedAt) {
      deduped.set(state.scriptName, state);
    }
  }

  return Object.fromEntries(deduped);
});

export const SidepanelLocalOptionsSchema = z
  .object({
    helpBannerDismissed: z.boolean().optional(),
    toolPanelHeightPx: z.number().finite().positive().optional(),
    userscriptReloadBannerDismissed: z.boolean().optional(),
  })
  .strict();

export const RecordPanelEntrySchema = z
  .unknown()
  .transform((value): RecordPanelState | null => coerceRecordPanelState(value))
  .refine((value): value is RecordPanelState => value !== null);

export const RecordPanelMapSchema = z.record(z.string().trim().min(1), z.unknown()).transform((record) => {
  const next: Record<string, RecordPanelState> = {};

  for (const [tabId, value] of Object.entries(record)) {
    const state = coerceRecordPanelState(value);
    if (!state) {
      continue;
    }

    next[tabId] = state;
  }

  return next;
});

export const SessionOpenTabsSchema = z.record(z.string().trim().min(1), z.boolean());
export const SessionSelectedScriptMapSchema = z.record(z.string().trim().min(1), z.string().trim().min(1));

export const buildDefaultRecordPanelEntry = () => buildDefaultRecordPanelState();

export { coerceRecordPanelState };
