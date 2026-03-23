import { resolveRecordConverterCollisions } from "./collision";
import {
  buildStepSnippet,
  type GeneratedReviewCode,
  isObserverBoundaryStep,
  type ParentTraversalOptionsByStepId,
  type ReviewCodeMode,
  type SelectElementOptionsByStepId,
} from "./generate";
import type { SupportedRecordStep } from "./normalize";

const selectedElementName = "selectedElement";
const clipboardHtmlName = "clipboardHtml";

type CombinedRenderState = {
  hasSelectedElementVar: boolean;
  hasClipboardVar: boolean;
};

type CombinedRenderResult = {
  lines: string[];
  state: CombinedRenderState;
};

type ExtractedCombinedStep = {
  bodyLines: string[];
  returnExpressions: string[];
};

type FunctionsRenderResult = {
  definitions: string[];
  invocations: string[];
};

const parseStepNumber = (stepId: string) => {
  const parsed = Number.parseInt(stepId.replace("step-", ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const buildStepFunctionName = (step: SupportedRecordStep) => `step${parseStepNumber(step.id)}`;
const buildRunnerFunctionName = (step: SupportedRecordStep) => `runAfterStep${parseStepNumber(step.id)}`;

const readStepCode = ({
  step,
  stepCodeByStepId,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
}: {
  step: SupportedRecordStep;
  stepCodeByStepId: Record<string, string>;
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
}) =>
  stepCodeByStepId[step.id] ??
  buildStepSnippet(step, parentOptions, defaultParentUntilSelector, selectOptions);

const extractFunctionName = (step: SupportedRecordStep, stepCode: string) => {
  const match = stepCode.match(/async function\s+([A-Za-z_$][\w$]*)\s*\(/);
  return match?.[1] ?? buildStepFunctionName(step);
};

const trimEmptyEdges = (lines: string[]) => {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim().length === 0) {
    start += 1;
  }
  while (end > start && lines[end - 1].trim().length === 0) {
    end -= 1;
  }

  return lines.slice(start, end);
};

const dedentBodyLines = (lines: string[]) =>
  lines.map((line) => (line.startsWith("  ") ? line.slice(2) : line));

const readFinalReturnLine = (lines: string[]) => {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const trimmed = lines[index].trim();
    if (trimmed.length === 0) {
      continue;
    }

    return {
      index,
      line: trimmed,
    };
  }

  return null;
};

const stripFinalReturnLine = (lines: string[]) => {
  const nextLines = [...lines];
  const finalReturnLine = readFinalReturnLine(nextLines);
  if (finalReturnLine?.line.startsWith("return ")) {
    nextLines.splice(finalReturnLine.index, 1);
  }
  return nextLines;
};

const parseReturnExpressions = (line: string) => {
  const match = line.match(/^return\s*\[(.*)\]\s*$/);
  if (!match) {
    return [] as string[];
  }

  return match[1]
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

const extractCombinedStep = (stepCode: string): ExtractedCombinedStep => {
  const lines = stepCode.replace(/\r\n/g, "\n").split("\n");
  const openingLineIndex = lines.findIndex((line) => line.includes("{"));
  const closingLineIndex = lines.length - 1 - [...lines].reverse().findIndex((line) => line.trim() === "}");

  if (openingLineIndex === -1 || closingLineIndex <= openingLineIndex) {
    const trimmedLines = trimEmptyEdges(lines).filter((line) => line.trim().length > 0);
    const finalReturnLine = readFinalReturnLine(trimmedLines);
    return {
      bodyLines: trimmedLines,
      returnExpressions: finalReturnLine ? parseReturnExpressions(finalReturnLine.line) : [],
    };
  }

  const bodyLines = dedentBodyLines(lines.slice(openingLineIndex + 1, closingLineIndex));
  const finalReturnLine = readFinalReturnLine(bodyLines);
  return {
    bodyLines: trimEmptyEdges(stripFinalReturnLine(bodyLines)).filter((line) => line.trim().length > 0),
    returnExpressions: finalReturnLine ? parseReturnExpressions(finalReturnLine.line) : [],
  };
};

const indentLines = (lines: string[], prefix = "  ") => lines.map((line) => `${prefix}${line}`);

const buildInvocationLine = (functionName: string, inputSource: string | null) => {
  const resultName = `${functionName}Result`;
  return {
    resultName,
    invocation:
      inputSource && inputSource.trim().length > 0
        ? `const ${resultName} = await ${functionName}(...${inputSource})`
        : `const ${resultName} = await ${functionName}()`,
  };
};

const buildRunnerFunctionCode = ({
  runnerName,
  inputNames,
  invocations,
}: {
  runnerName: string;
  inputNames: string[];
  invocations: string[];
}) => {
  const lines = [`async function ${runnerName}(${inputNames.join(", ")}) {`];
  if (invocations.length > 0) {
    lines.push(...invocations.map((line) => `  ${line}`));
  }
  lines.push("}");
  return lines.join("\n");
};

const getPassthroughExtras = (inputNames: string[], ...exclude: string[]) =>
  inputNames.filter((name) => !exclude.includes(name));

const getStepOutputNames = (step: SupportedRecordStep, inputNames: string[]) => {
  if (step.kind === "delete-element") {
    return [] as string[];
  }

  if (step.kind === "cut-element") {
    return [
      selectedElementName,
      clipboardHtmlName,
      ...getPassthroughExtras(inputNames, selectedElementName, clipboardHtmlName),
    ];
  }

  if (step.kind === "copy-element" || step.kind === "paste-element") {
    return [
      selectedElementName,
      clipboardHtmlName,
      ...getPassthroughExtras(inputNames, selectedElementName, clipboardHtmlName),
    ];
  }

  return [selectedElementName, ...getPassthroughExtras(inputNames, selectedElementName)];
};

const ensureClipboardVar = (lines: string[], state: CombinedRenderState) => {
  if (state.hasClipboardVar) {
    return state;
  }

  lines.push(`let ${clipboardHtmlName} = null`);
  return { ...state, hasClipboardVar: true };
};

const extractObserverSetup = (stepCode: string) => {
  const { bodyLines } = extractCombinedStep(stepCode);
  const callbackLineIndex = bodyLines.findIndex((line) => line.includes(".onElementMatches("));
  if (callbackLineIndex === -1) {
    return {
      setupLines: bodyLines,
      selectorVarName: "selector",
      callbackParamName: selectedElementName,
    };
  }

  const callbackLine = bodyLines[callbackLineIndex];
  const selectorMatch = callbackLine.match(/([A-Za-z_$][\w$]*)\.onElementMatches\(/);
  const callbackParamMatch = callbackLine.match(/onElementMatches\((?:async\s*)?\(?([A-Za-z_$][\w$]*)/);

  return {
    setupLines: bodyLines.slice(0, callbackLineIndex),
    selectorVarName: selectorMatch?.[1] ?? "selector",
    callbackParamName: callbackParamMatch?.[1] ?? selectedElementName,
  };
};

const resolveGeneratedCode = (rawCode: string, existingCode: string) => {
  const resolved = resolveRecordConverterCollisions({
    code: rawCode,
    existingCode,
  });

  return {
    rawCode,
    finalCode: resolved.finalCode,
    renameMap: resolved.renameMap,
  };
};

const buildFunctionsSequenceFromStepPreviews = ({
  steps,
  stepCodeByStepId,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
  startIndex,
  inputNames,
  inputSource,
}: {
  steps: SupportedRecordStep[];
  stepCodeByStepId: Record<string, string>;
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
  startIndex: number;
  inputNames: string[];
  inputSource: string | null;
}): FunctionsRenderResult => {
  if (startIndex >= steps.length) {
    return { definitions: [], invocations: [] };
  }

  const step = steps[startIndex];
  const stepCode = readStepCode({
    step,
    stepCodeByStepId,
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
  });
  const functionName = extractFunctionName(step, stepCode);
  const { resultName, invocation } = buildInvocationLine(functionName, inputSource);

  if (
    isObserverBoundaryStep({
      step,
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
    })
  ) {
    const runnerName = buildRunnerFunctionName(step);
    const runnerInputNames = getStepOutputNames(step, inputNames);
    const runnerSequence = buildFunctionsSequenceFromStepPreviews({
      steps,
      stepCodeByStepId,
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
      startIndex: startIndex + 1,
      inputNames: runnerInputNames,
      inputSource: null,
    });

    return {
      definitions: [
        stepCode,
        ...runnerSequence.definitions,
        buildRunnerFunctionCode({
          runnerName,
          inputNames: runnerInputNames,
          invocations: runnerSequence.invocations,
        }),
      ],
      invocations: [invocation],
    };
  }

  const nextSequence = buildFunctionsSequenceFromStepPreviews({
    steps,
    stepCodeByStepId,
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
    startIndex: startIndex + 1,
    inputNames: getStepOutputNames(step, inputNames),
    inputSource: resultName,
  });

  return {
    definitions: [stepCode, ...nextSequence.definitions],
    invocations: [invocation, ...nextSequence.invocations],
  };
};

const buildCombinedSequenceFromStepPreviews = ({
  steps,
  stepCodeByStepId,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
  startIndex,
  state,
  inputNames,
}: {
  steps: SupportedRecordStep[];
  stepCodeByStepId: Record<string, string>;
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
  startIndex: number;
  state: CombinedRenderState;
  inputNames: string[];
}): CombinedRenderResult => {
  if (startIndex >= steps.length) {
    return { lines: [], state };
  }

  const step = steps[startIndex];
  const stepCode = readStepCode({
    step,
    stepCodeByStepId,
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
  });

  if (
    isObserverBoundaryStep({
      step,
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
    })
  ) {
    const observerSetup = extractObserverSetup(stepCode);
    const nested = buildCombinedSequenceFromStepPreviews({
      steps,
      stepCodeByStepId,
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
      startIndex: startIndex + 1,
      state: {
        hasSelectedElementVar: true,
        hasClipboardVar: state.hasClipboardVar,
      },
      inputNames: getStepOutputNames(step, inputNames),
    });

    return {
      lines: [
        ...observerSetup.setupLines,
        `${observerSetup.selectorVarName}.onElementMatches(async (${observerSetup.callbackParamName}) => {`,
        ...indentLines(
          observerSetup.callbackParamName === selectedElementName
            ? nested.lines
            : [`let ${selectedElementName} = ${observerSetup.callbackParamName}`, ...nested.lines],
        ),
        "})",
      ],
      state,
    };
  }

  const { bodyLines, returnExpressions } = extractCombinedStep(stepCode);
  const lines = [...bodyLines];
  let nextState = { ...state };
  if (step.kind === "copy-element" || step.kind === "cut-element" || step.kind === "paste-element") {
    nextState = ensureClipboardVar(lines, nextState);
  }

  if (step.kind === "select-element") {
    nextState = { ...nextState, hasSelectedElementVar: true };
  }

  const outputNames = getStepOutputNames(step, inputNames);
  outputNames.forEach((outputName, index) => {
    const expression = returnExpressions[index];
    if (!expression || expression === outputName) {
      return;
    }

    lines.push(`${outputName} = ${expression}`);
  });

  const next = buildCombinedSequenceFromStepPreviews({
    steps,
    stepCodeByStepId,
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
    startIndex: startIndex + 1,
    state: nextState,
    inputNames: outputNames,
  });

  return {
    lines: [...lines, ...next.lines],
    state: next.state,
  };
};

const buildFunctionsRawCodeFromStepPreviews = ({
  steps,
  stepCodeByStepId,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  stepCodeByStepId: Record<string, string>;
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
}) => {
  if (steps.length === 0) {
    return "";
  }

  const rendered = buildFunctionsSequenceFromStepPreviews({
    steps,
    stepCodeByStepId,
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
    startIndex: 0,
    inputNames: [],
    inputSource: null,
  });

  return [rendered.definitions.join("\n\n"), rendered.invocations.join("\n")]
    .filter((section) => section.trim().length > 0)
    .join("\n\n");
};

const buildCombinedRawCodeFromStepPreviews = ({
  steps,
  stepCodeByStepId,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  stepCodeByStepId: Record<string, string>;
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
}) => {
  if (steps.length === 0) {
    return "";
  }

  return buildCombinedSequenceFromStepPreviews({
    steps,
    stepCodeByStepId,
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
    startIndex: 0,
    state: {
      hasSelectedElementVar: false,
      hasClipboardVar: false,
    },
    inputNames: [],
  }).lines.join("\n");
};

export const buildReviewCodeFromStepPreviews = ({
  steps,
  stepCodeByStepId = {},
  parentOptions = {},
  selectOptions = {},
  existingCode,
  defaultParentUntilSelector = "body",
}: {
  steps: SupportedRecordStep[];
  stepCodeByStepId?: Record<string, string>;
  parentOptions?: ParentTraversalOptionsByStepId;
  selectOptions?: SelectElementOptionsByStepId;
  existingCode: string;
  defaultParentUntilSelector?: string;
}): GeneratedReviewCode => {
  const byMode: Record<ReviewCodeMode, GeneratedReviewCode["byMode"][ReviewCodeMode]> = {
    combined: resolveGeneratedCode(
      buildCombinedRawCodeFromStepPreviews({
        steps,
        stepCodeByStepId,
        parentOptions,
        selectOptions,
        defaultParentUntilSelector,
      }),
      existingCode,
    ),
    functions: resolveGeneratedCode(
      buildFunctionsRawCodeFromStepPreviews({
        steps,
        stepCodeByStepId,
        parentOptions,
        selectOptions,
        defaultParentUntilSelector,
      }),
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
