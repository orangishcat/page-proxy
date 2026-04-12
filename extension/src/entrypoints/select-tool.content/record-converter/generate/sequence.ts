import { resolveRecordConverterCollisions } from "../collision";
import type { SupportedRecordStep } from "../normalize";
import { createStep } from "./step-factory";
import type {
  CombinedRenderState,
  FunctionsRenderResult,
  GeneratedReviewCode,
  GeneratedReviewCodeByModeEntry,
  ParentTraversalOptionsByStepId,
  ReviewCodeMode,
  SelectElementOptionsByStepId,
} from "./types";
import {
  buildFunctionParameters,
  buildInvocationLine,
  buildRunnerFunctionName,
  buildStepFunctionName,
  getParentOption,
  getSelectElementOption,
  parseStepNumber,
  normalizeUntilSelector,
} from "./utils";

type CombinedSequenceResult = {
  lines: string[];
  state: CombinedRenderState;
};

const splitStepsByResetTopLevel = ({
  steps,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
}) => {
  const segments: SupportedRecordStep[][] = [];
  let currentSegment: SupportedRecordStep[] = [];

  steps.forEach((step) => {
    const parentOption = getParentOption(step, parentOptions, defaultParentUntilSelector);
    const selectOption = getSelectElementOption(step, selectOptions);
    const resetTopLevel = createStep(step, parentOption, selectOption).resetTopLevel ?? false;

    if (resetTopLevel && currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [step];
      return;
    }

    currentSegment.push(step);
  });

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
};

const usesClipboardVariable = (steps: SupportedRecordStep[]) =>
  steps.some((step) => step.kind === "copy-element" || step.kind === "cut-element" || step.kind === "paste-element");

const needsExternalClipboard = (steps: SupportedRecordStep[]) => {
  let hasLocalClipboard = false;

  for (const step of steps) {
    if (step.kind === "copy-element" || step.kind === "cut-element") {
      hasLocalClipboard = true;
      continue;
    }

    if (step.kind === "paste-element" && !hasLocalClipboard) {
      return true;
    }
  }

  return false;
};

const canSplitFunctionsTopLevel = (segments: SupportedRecordStep[][]) =>
  segments.length > 1 && segments.slice(1).every((segment) => !needsExternalClipboard(segment));

const buildGeneratedRunnerCode = ({
  runnerName,
  inputNames,
  invocations,
}: {
  runnerName: string;
  inputNames: string[];
  invocations: string[];
}) => {
  const lines = [`async function ${runnerName}(${buildFunctionParameters(inputNames)}) {`];
  if (invocations.length > 0) {
    lines.push(...invocations.map((line) => `  ${line}`));
  }
  lines.push("}");
  return lines.join("\n");
};

const buildFunctionsSequence = ({
  steps,
  startIndex,
  inputNames,
  inputSource,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  startIndex: number;
  inputNames: string[];
  inputSource: string | null;
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
}): FunctionsRenderResult => {
  if (startIndex >= steps.length) {
    return { definitions: [], invocations: [] };
  }

  const step = steps[startIndex];
  const stepNumber = parseStepNumber(step.id);
  const parentOption = getParentOption(step, parentOptions, defaultParentUntilSelector);
  const selectOption = getSelectElementOption(step, selectOptions);
  const generator = createStep(step, parentOption, selectOption);
  const functionName = buildStepFunctionName(stepNumber);
  const builtStep = generator.buildFunctionCode({ functionName, inputNames, stepNumber });
  const { resultName, invocation } = buildInvocationLine(builtStep.functionName, inputSource);

  if (generator.isObserverBoundary()) {
    const runnerName = buildRunnerFunctionName(stepNumber);
    const runnerInputNames = generator.getOutputNames(inputNames);
    const runnerSequence = buildFunctionsSequence({
      steps,
      startIndex: startIndex + 1,
      inputNames: runnerInputNames,
      inputSource: null,
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
    });

    return {
      definitions: [
        builtStep.code,
        ...runnerSequence.definitions,
        buildGeneratedRunnerCode({
          runnerName,
          inputNames: runnerInputNames,
          invocations: runnerSequence.invocations,
        }),
      ],
      invocations: [invocation],
    };
  }

  const nextSequence = buildFunctionsSequence({
    steps,
    startIndex: startIndex + 1,
    inputNames: builtStep.outputNames,
    inputSource: resultName,
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
  });

  return {
    definitions: [builtStep.code, ...nextSequence.definitions],
    invocations: [invocation, ...nextSequence.invocations],
  };
};

const buildCombinedSequence = ({
  steps,
  startIndex,
  state,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  startIndex: number;
  state: CombinedRenderState;
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
}): CombinedSequenceResult => {
  if (startIndex >= steps.length) {
    return { lines: [], state };
  }

  const step = steps[startIndex];
  const stepNumber = parseStepNumber(step.id);
  const parentOption = getParentOption(step, parentOptions, defaultParentUntilSelector);
  const selectOption = getSelectElementOption(step, selectOptions);
  const generator = createStep(step, parentOption, selectOption);

  if (generator.isObserverBoundary()) {
    const nested = buildCombinedSequence({
      steps,
      startIndex: startIndex + 1,
      state: { hasSelectedElementVar: true, hasClipboardVar: state.hasClipboardVar },
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
    });

    return {
      lines: generator.buildCombinedObserverLines!({ stepNumber, callbackLines: nested.lines }),
      state,
    };
  }

  const current = generator.buildCombinedLines({ stepNumber, state });
  const next = buildCombinedSequence({
    steps,
    startIndex: startIndex + 1,
    state: current.state,
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
  });

  return {
    lines: [...current.lines, ...next.lines],
    state: next.state,
  };
};

const buildFunctionsRawCode = ({
  steps,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
}) => {
  const renderSegment = (segment: SupportedRecordStep[]) => {
    const rendered = buildFunctionsSequence({
      steps: segment,
      startIndex: 0,
      inputNames: [],
      inputSource: null,
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
    });

    return [rendered.definitions.join("\n\n"), rendered.invocations.join("\n")]
      .filter((section) => section.trim().length > 0)
      .join("\n\n");
  };

  const segments = splitStepsByResetTopLevel({
    steps,
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
  });

  if (!canSplitFunctionsTopLevel(segments)) {
    return renderSegment(steps);
  }

  return segments.map(renderSegment).filter((section) => section.trim().length > 0).join("\n\n");
};

const buildCombinedRawCode = ({
  steps,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
}) => {
  if (steps.length === 0) {
    return "";
  }

  const segments = splitStepsByResetTopLevel({
    steps,
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
  });
  const hoistClipboardVar = segments.length > 1 && usesClipboardVariable(steps);
  const lines = hoistClipboardVar ? ["let clipboardHtml = null"] : [];

  for (const segment of segments) {
    const rendered = buildCombinedSequence({
      steps: segment,
      startIndex: 0,
      state: {
        hasSelectedElementVar: false,
        hasClipboardVar: hoistClipboardVar,
      },
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
    });
    lines.push(...rendered.lines);
  }

  return lines.join("\n");
};

const resolveGeneratedCode = (rawCode: string, existingCode: string): GeneratedReviewCodeByModeEntry => {
  const resolved = resolveRecordConverterCollisions({ code: rawCode, existingCode });
  return {
    rawCode,
    finalCode: resolved.finalCode,
    renameMap: resolved.renameMap,
  };
};

export const buildGeneratedReviewCode = ({
  steps,
  parentOptions,
  selectOptions = {},
  existingCode,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions?: SelectElementOptionsByStepId;
  existingCode: string;
  defaultParentUntilSelector?: string;
}): GeneratedReviewCode => {
  const resolvedDefaultParentUntilSelector = normalizeUntilSelector(defaultParentUntilSelector ?? "");
  const byMode: Record<ReviewCodeMode, GeneratedReviewCodeByModeEntry> = {
    combined: resolveGeneratedCode(
      buildCombinedRawCode({ steps, parentOptions, selectOptions, defaultParentUntilSelector: resolvedDefaultParentUntilSelector }),
      existingCode,
    ),
    functions: resolveGeneratedCode(
      buildFunctionsRawCode({ steps, parentOptions, selectOptions, defaultParentUntilSelector: resolvedDefaultParentUntilSelector }),
      existingCode,
    ),
  };
  const defaultMode = byMode.combined;

  return {
    rawCode: defaultMode.rawCode,
    finalCode: defaultMode.finalCode,
    renameMap: defaultMode.renameMap,
    byMode,
  };
};
