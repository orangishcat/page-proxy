import type { RecordTimelineEntry } from "@/lib/selection";

export type SupportedRecordStepKind = "select-element" | "select-parent";

export type SupportedRecordStep = {
  id: string;
  kind: SupportedRecordStepKind;
  count: number;
  label: string;
  selectorHint: string | null;
  sourceEntries: RecordTimelineEntry[];
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
  return null;
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
      previousStep.label = buildStepLabel(previousStep.kind, previousStep.count);
      lastSupportedKind = "select-parent";
      return;
    }

    stepCounter += 1;
    supportedSteps.push({
      id: `step-${stepCounter}`,
      kind,
      count: kind === "select-parent" ? 1 : 0,
      label: buildStepLabel(kind, kind === "select-parent" ? 1 : 0),
      selectorHint: kind === "select-element" ? readSelectorHint(entry.detail) : null,
      sourceEntries: [entry],
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
