import type { RecordTimelineEntry } from "@/lib/selection";

export type SupportedRecordStepKind =
  | "select-element"
  | "select-parent"
  | "click-element"
  | "delete-element"
  | "cut-element"
  | "copy-element"
  | "paste-element"
  | "apply-style-element";

export type SupportedRecordStep = {
  id: string;
  kind: SupportedRecordStepKind;
  count: number;
  label: string;
  selectorHint: string | null;
  sourceEntries: RecordTimelineEntry[];
  cssValues?: Record<string, string>;
};

export type NormalizedRecordSteps = {
  supportedSteps: SupportedRecordStep[];
  skippedEntries: RecordTimelineEntry[];
};

const normalizeAction = (action: string): SupportedRecordStepKind | null => {
  const normalized = action.trim().toLowerCase();
  if (normalized === "selected element") {
    return "select-element";
  }
  if (normalized === "selected parent element") {
    return "select-parent";
  }
  if (normalized === "click" || normalized === "click element" || normalized === "clicked element") {
    return "click-element";
  }
  if (normalized === "deleted element") {
    return "delete-element";
  }
  if (normalized === "cut element") {
    return "cut-element";
  }
  if (normalized === "copied element") {
    return "copy-element";
  }
  if (normalized === "pasted element") {
    return "paste-element";
  }
  if (normalized === "applied style") {
    return "apply-style-element";
  }
  return null;
};

const parseCssValuesDetail = (detail: string): Record<string, string> | undefined => {
  const trimmed = detail.trim();
  if (!trimmed.startsWith("{")) {
    return undefined;
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, string>;
  }
  return undefined;
};

const readSelectorHint = (detail: string) => {
  const normalizedDetail = detail.trim();
  if (normalizedDetail.length === 0) {
    return null;
  }

  const selectorMatch = normalizedDetail.match(/selector:\s*(.+)$/i);
  if (selectorMatch?.[1]) {
    return selectorMatch[1].trim() || null;
  }
  return null;
};

const buildStepLabel = (kind: SupportedRecordStepKind, count: number) => {
  if (kind === "select-element") {
    return "Selected element";
  }
  if (kind === "click-element") {
    return "Click element";
  }
  if (kind === "delete-element") {
    return "Delete element";
  }
  if (kind === "cut-element") {
    return "Cut element";
  }
  if (kind === "copy-element") {
    return "Copy element";
  }
  if (kind === "paste-element") {
    return "Paste element";
  }
  if (kind === "apply-style-element") {
    return "Apply style";
  }

  if (count > 1) {
    return `Select parent element x${count}`;
  }
  return "Select parent element";
};

export const normalizeRecordTimeline = (timeline: RecordTimelineEntry[]): NormalizedRecordSteps => {
  const orderedTimeline = [...timeline].sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }

    return left.id.localeCompare(right.id);
  });
  const supportedSteps: SupportedRecordStep[] = [];
  const skippedEntries: RecordTimelineEntry[] = [];
  let stepCounter = 0;
  let lastSupportedKind: SupportedRecordStepKind | null = null;

  orderedTimeline.forEach((entry) => {
    const kind = normalizeAction(entry.action);
    if (!kind) {
      skippedEntries.push(entry);
      lastSupportedKind = null;
      return;
    }

    const previousStep = supportedSteps[supportedSteps.length - 1];
    if (kind === "select-parent" && previousStep?.kind === "select-parent" && lastSupportedKind === "select-parent") {
      previousStep.count += 1;
      previousStep.sourceEntries.push(entry);
      const groupedSelectorHint = readSelectorHint(entry.detail);
      if (groupedSelectorHint) {
        previousStep.selectorHint = groupedSelectorHint;
      }
      previousStep.label = buildStepLabel(previousStep.kind, previousStep.count);
      lastSupportedKind = "select-parent";
      return;
    }

    const cssValues: Record<string, string> | undefined =
      kind === "apply-style-element" ? parseCssValuesDetail(entry.detail) : undefined;

    stepCounter += 1;
    supportedSteps.push({
      id: `step-${stepCounter}`,
      kind,
      count: kind === "select-parent" ? 1 : 0,
      label: buildStepLabel(kind, kind === "select-parent" ? 1 : 0),
      selectorHint: readSelectorHint(entry.detail),
      sourceEntries: [entry],
      cssValues,
    });
    lastSupportedKind = kind;
  });

  return {
    supportedSteps,
    skippedEntries,
  };
};

export const startsWithSelectedElement = (steps: SupportedRecordStep[]) => {
  return steps[0]?.kind === "select-element";
};
