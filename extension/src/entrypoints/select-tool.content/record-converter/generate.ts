import { resolveRecordConverterCollisions } from "./collision";
import type { SupportedRecordStep } from "./normalize";
import { getSelectorFallback } from "../popup/selector";

export type ParentTraversalMode = "traverse-until" | "traverse-n-times" | "selector-reselect";
export type SelectElementMode = "wait-until-match" | "on-element-matches";

export type ParentTraversalOption = {
  mode: ParentTraversalMode;
  untilSelector: string;
  count: number;
};

export type SelectElementOption = {
  mode: SelectElementMode;
};

export type ParentTraversalOptionsByStepId = Record<string, ParentTraversalOption>;
export type SelectElementOptionsByStepId = Record<string, SelectElementOption>;
export type ReviewCodeMode = "combined" | "functions";

type GeneratedReviewCodeByModeEntry = {
  rawCode: string;
  finalCode: string;
  renameMap: Record<string, string>;
};

export type GeneratedReviewCode = {
  rawCode: string;
  finalCode: string;
  renameMap: Record<string, string>;
  byMode: Record<ReviewCodeMode, GeneratedReviewCodeByModeEntry>;
};

type StepOutputBinding = {
  name: string;
  expression: string;
};

type BuiltStepCode = {
  functionName: string;
  inputNames: string[];
  code: string;
  outputNames: string[];
};

type CombinedRenderState = {
  hasSelectedElementVar: boolean;
  hasClipboardVar: boolean;
};

type CombinedRenderResult = {
  lines: string[];
  state: CombinedRenderState;
};

type FunctionsRenderResult = {
  definitions: string[];
  invocations: string[];
};

const stepInputOutputName = "selectedElement";
const clipboardHtmlName = "clipboardHtml";

const getPassthroughExtras = (inputNames: string[], ...exclude: string[]) =>
  inputNames.filter((name) => !exclude.includes(name));

const toStringLiteral = (value: string) => JSON.stringify(value);

const resolveSelectElementSelector = (step: SupportedRecordStep) => {
  return step.selectorHint && step.selectorHint.trim().length > 0 ? step.selectorHint.trim() : getSelectorFallback();
};

const normalizeTraversalCount = (count: number) => {
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
};

const normalizeUntilSelector = (value: string) => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : getSelectorFallback();
};

const parseStepNumber = (stepId: string) => {
  const parsed = Number.parseInt(stepId.replace("step-", ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const buildStepFunctionName = (stepNumber: number) => `step${stepNumber}`;
const buildRunnerFunctionName = (stepNumber: number) => `runAfterStep${stepNumber}`;
const toNextSelectedElementName = () => `next${stepInputOutputName[0].toUpperCase()}${stepInputOutputName.slice(1)}`;

const buildFunctionParameters = (inputNames: string[]) => {
  if (inputNames.length === 0) {
    return "";
  }

  return inputNames.join(", ");
};

const buildReturnLine = (outputs: StepOutputBinding[]) => {
  if (outputs.length === 0) {
    return "  return []";
  }

  return `  return [${outputs.map((output) => output.expression).join(", ")}]`;
};

const buildStepFunctionCode = ({
  functionName,
  inputNames,
  bodyLines,
  outputs,
}: {
  functionName: string;
  inputNames: string[];
  bodyLines: string[];
  outputs: StepOutputBinding[];
}) => {
  return [
    `async function ${functionName}(${buildFunctionParameters(inputNames)}) {`,
    ...bodyLines.map((line) => `  ${line}`),
    buildReturnLine(outputs),
    "}",
  ].join("\n");
};

const indentLines = (lines: string[], prefix = "  ") => lines.map((line) => `${prefix}${line}`);

const buildInvocationLine = (functionName: string, inputSource: string | null) => {
  const resultName = `${functionName}Result`;
  const invocation =
    inputSource && inputSource.trim().length > 0
      ? `const ${resultName} = await ${functionName}(...${inputSource})`
      : `const ${resultName} = await ${functionName}()`;

  return {
    resultName,
    invocation,
  };
};

const buildSelectorLines = ({
  selectorName,
  selectorValue,
  selectorLabel,
}: {
  selectorName: string;
  selectorValue: string;
  selectorLabel: string;
}) => {
  return [
    `const ${selectorName} = pq.selector({`,
    `  name: ${toStringLiteral(selectorLabel)},`,
    `  baseSelector: ${toStringLiteral(selectorValue)},`,
    "  matches: e => true",
    "})",
  ];
};

const getSelectElementOption = (step: SupportedRecordStep, selectOptions: SelectElementOptionsByStepId): SelectElementOption => {
  return step.kind === "select-element" ? (selectOptions[step.id] ?? buildDefaultSelectElementOption()) : buildDefaultSelectElementOption();
};

const getParentOption = (
  step: SupportedRecordStep,
  parentOptions: ParentTraversalOptionsByStepId,
  defaultParentUntilSelector: string,
): ParentTraversalOption => {
  return parentOptions[step.id] ?? buildDefaultParentTraversalOption(step.count, defaultParentUntilSelector);
};

const getStepOutputNames = ({
  step,
  inputNames,
}: {
  step: SupportedRecordStep;
  inputNames: string[];
}) => {
  if (step.kind === "delete-element") {
    return [] as string[];
  }

  if (step.kind === "cut-element") {
    return [
      stepInputOutputName,
      clipboardHtmlName,
      ...getPassthroughExtras(inputNames, stepInputOutputName, clipboardHtmlName),
    ];
  }

  if (step.kind === "copy-element" || step.kind === "paste-element") {
    return [
      stepInputOutputName,
      clipboardHtmlName,
      ...getPassthroughExtras(inputNames, stepInputOutputName, clipboardHtmlName),
    ];
  }

  return [stepInputOutputName, ...getPassthroughExtras(inputNames, stepInputOutputName)];
};

export const isObserverBoundaryStep = ({
  step,
  parentOptions,
  selectOptions,
  defaultParentUntilSelector,
}: {
  step: SupportedRecordStep;
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
}) => {
  if (step.kind === "select-element") {
    return getSelectElementOption(step, selectOptions).mode === "on-element-matches";
  }

  if (step.kind === "select-parent") {
    return getParentOption(step, parentOptions, defaultParentUntilSelector).mode === "selector-reselect";
  }

  return false;
};

const buildSelectWaitStepCode = ({
  functionName,
  inputNames,
  selectorValue,
  selectorLabel,
}: {
  functionName: string;
  inputNames: string[];
  selectorValue: string;
  selectorLabel: string;
}) => {
  const extras = getPassthroughExtras(inputNames, stepInputOutputName);
  const assignmentLine = inputNames.includes(stepInputOutputName)
    ? `${stepInputOutputName} = await selector.waitUntilMatch()`
    : `let ${stepInputOutputName} = await selector.waitUntilMatch()`;

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines: [...buildSelectorLines({ selectorName: "selector", selectorValue, selectorLabel }), assignmentLine],
      outputs: [
        { name: stepInputOutputName, expression: stepInputOutputName },
        ...extras.map((name) => ({ name, expression: name })),
      ],
    }),
    outputNames: [stepInputOutputName, ...extras],
  } satisfies BuiltStepCode;
};

const buildSelectObserverStepCode = ({
  stepNumber,
  functionName,
  inputNames,
  selectorValue,
  selectorLabel,
}: {
  stepNumber: number;
  functionName: string;
  inputNames: string[];
  selectorValue: string;
  selectorLabel: string;
}) => {
  const extras = getPassthroughExtras(inputNames, stepInputOutputName);
  const runnerName = buildRunnerFunctionName(stepNumber);
  const callbackArgs = [stepInputOutputName, ...extras];
  const callbackArgList = callbackArgs.join(", ");

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines: [
        ...buildSelectorLines({ selectorName: "selector", selectorValue, selectorLabel }),
        `selector.onElementMatches((${stepInputOutputName}) => {`,
        `  void ${runnerName}(${callbackArgList})`,
        "})",
      ],
      outputs: [],
    }),
    outputNames: [stepInputOutputName, ...extras],
  } satisfies BuiltStepCode;
};

const buildTraverseUntilStepCode = ({
  stepNumber,
  functionName,
  inputNames,
  option,
}: {
  stepNumber: number;
  functionName: string;
  inputNames: string[];
  option: ParentTraversalOption;
}) => {
  const untilSelector = normalizeUntilSelector(option.untilSelector);
  const selectedElementInput = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
  const nextElementName = toNextSelectedElementName();
  const extras = getPassthroughExtras(inputNames, stepInputOutputName);

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines: [
        ...buildSelectorLines({
          selectorName: "traverseUntilSelector",
          selectorValue: untilSelector,
          selectorLabel: `Traverse until selector ${stepNumber}`,
        }),
        `const ${nextElementName} = ${selectedElementInput}`,
        `  ? pq.traverseParents(${selectedElementInput}, e => traverseUntilSelector.matches(e))`,
        "  : null",
      ],
      outputs: [
        { name: stepInputOutputName, expression: nextElementName },
        ...extras.map((name) => ({ name, expression: name })),
      ],
    }),
    outputNames: [stepInputOutputName, ...extras],
  } satisfies BuiltStepCode;
};

const buildTraverseCountStepCode = ({
  functionName,
  inputNames,
  option,
}: {
  functionName: string;
  inputNames: string[];
  option: ParentTraversalOption;
}) => {
  const count = normalizeTraversalCount(option.count);
  const nextElementName = toNextSelectedElementName();
  const selectedElementInput = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
  const extras = getPassthroughExtras(inputNames, stepInputOutputName);

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines: [
        `let ${nextElementName} = ${selectedElementInput}`,
        `const parentCount = ${count}`,
        "for (let i = 0; i < parentCount; i += 1) {",
        `  if (!${nextElementName} || !${nextElementName}.parentElement) {`,
        `    ${nextElementName} = null`,
        "    break",
        "  }",
        `  ${nextElementName} = ${nextElementName}.parentElement`,
        "}",
      ],
      outputs: [
        { name: stepInputOutputName, expression: nextElementName },
        ...extras.map((name) => ({ name, expression: name })),
      ],
    }),
    outputNames: [stepInputOutputName, ...extras],
  } satisfies BuiltStepCode;
};

const buildDeleteStepCode = ({
  functionName,
  inputNames,
}: {
  functionName: string;
  inputNames: string[];
}) => {
  const removableElement = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines: [`if (${removableElement}) {`, `  ${removableElement}.remove()`, "}"],
      outputs: [],
    }),
    outputNames: [],
  } satisfies BuiltStepCode;
};

const buildClickStepCode = ({
  functionName,
  inputNames,
}: {
  functionName: string;
  inputNames: string[];
}) => {
  const clickableElement = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
  const extras = getPassthroughExtras(inputNames, stepInputOutputName);

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines: [`if (${clickableElement}) {`, `  ${clickableElement}.click()`, "}"],
      outputs: [
        { name: stepInputOutputName, expression: clickableElement },
        ...extras.map((name) => ({ name, expression: name })),
      ],
    }),
    outputNames: [stepInputOutputName, ...extras],
  } satisfies BuiltStepCode;
};

const buildCutStepCode = ({
  functionName,
  inputNames,
}: {
  functionName: string;
  inputNames: string[];
}) => {
  const el = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
  const extras = getPassthroughExtras(inputNames, stepInputOutputName, clipboardHtmlName);

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines: [
        `const ${clipboardHtmlName} = ${el} ? ${el}.outerHTML : null`,
        `if (${el}) {`,
        `  ${el}.remove()`,
        "}",
      ],
      outputs: [
        { name: stepInputOutputName, expression: "null" },
        { name: clipboardHtmlName, expression: clipboardHtmlName },
        ...extras.map((name) => ({ name, expression: name })),
      ],
    }),
    outputNames: [stepInputOutputName, clipboardHtmlName, ...extras],
  } satisfies BuiltStepCode;
};

const buildCopyStepCode = ({
  functionName,
  inputNames,
}: {
  functionName: string;
  inputNames: string[];
}) => {
  const el = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
  const extras = getPassthroughExtras(inputNames, stepInputOutputName, clipboardHtmlName);

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines: [`const ${clipboardHtmlName} = ${el} ? ${el}.outerHTML : null`],
      outputs: [
        { name: stepInputOutputName, expression: el },
        { name: clipboardHtmlName, expression: clipboardHtmlName },
        ...extras.map((name) => ({ name, expression: name })),
      ],
    }),
    outputNames: [stepInputOutputName, clipboardHtmlName, ...extras],
  } satisfies BuiltStepCode;
};

const buildPasteStepCode = ({
  functionName,
  inputNames,
}: {
  functionName: string;
  inputNames: string[];
}) => {
  const el = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
  const extras = getPassthroughExtras(inputNames, stepInputOutputName, clipboardHtmlName);
  const functionInputNames = inputNames.includes(clipboardHtmlName) ? inputNames : [...inputNames, clipboardHtmlName];

  return {
    functionName,
    inputNames: functionInputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames: functionInputNames,
      bodyLines: [`if (${el} && ${clipboardHtmlName}) {`, `  ${el}.insertAdjacentHTML("afterend", ${clipboardHtmlName})`, "}"],
      outputs: [
        { name: stepInputOutputName, expression: el },
        { name: clipboardHtmlName, expression: clipboardHtmlName },
        ...extras.map((name) => ({ name, expression: name })),
      ],
    }),
    outputNames: [stepInputOutputName, clipboardHtmlName, ...extras],
  } satisfies BuiltStepCode;
};

const buildApplyStyleStepCode = ({
  functionName,
  inputNames,
  cssValues,
}: {
  functionName: string;
  inputNames: string[];
  cssValues?: Record<string, string>;
}) => {
  const el = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
  const extras = getPassthroughExtras(inputNames, stepInputOutputName);
  const cssEntries = Object.entries(cssValues ?? {});
  const bodyLines =
    cssEntries.length === 0
      ? ["// Applied style (no CSS properties recorded)"]
      : [
          `if (${el}) {`,
          `  ps.applyStyle([${el}], {`,
          ...cssEntries.map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)},`),
          "  })",
          "}",
        ];

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines,
      outputs: [
        { name: stepInputOutputName, expression: el },
        ...extras.map((name) => ({ name, expression: name })),
      ],
    }),
    outputNames: [stepInputOutputName, ...extras],
  } satisfies BuiltStepCode;
};

const buildGeneratedStepCode = ({
  step,
  stepNumber,
  inputNames,
  parentOption,
  selectOption,
}: {
  step: SupportedRecordStep;
  stepNumber: number;
  inputNames: string[];
  parentOption: ParentTraversalOption;
  selectOption: SelectElementOption;
}): BuiltStepCode => {
  const functionName = buildStepFunctionName(stepNumber);

  if (step.kind === "select-element") {
    if (selectOption.mode === "on-element-matches") {
      return buildSelectObserverStepCode({
        stepNumber,
        functionName,
        inputNames,
        selectorValue: resolveSelectElementSelector(step),
        selectorLabel: `Selector ${stepNumber}`,
      });
    }

    return buildSelectWaitStepCode({
      functionName,
      inputNames,
      selectorValue: resolveSelectElementSelector(step),
      selectorLabel: `Selector ${stepNumber}`,
    });
  }

  if (step.kind === "delete-element") {
    return buildDeleteStepCode({ functionName, inputNames });
  }

  if (step.kind === "click-element") {
    return buildClickStepCode({ functionName, inputNames });
  }

  if (step.kind === "cut-element") {
    return buildCutStepCode({ functionName, inputNames });
  }

  if (step.kind === "copy-element") {
    return buildCopyStepCode({ functionName, inputNames });
  }

  if (step.kind === "paste-element") {
    return buildPasteStepCode({ functionName, inputNames });
  }

  if (step.kind === "apply-style-element") {
    return buildApplyStyleStepCode({ functionName, inputNames, cssValues: step.cssValues });
  }

  if (parentOption.mode === "selector-reselect") {
    return buildSelectObserverStepCode({
      stepNumber,
      functionName,
      inputNames,
      selectorValue: normalizeUntilSelector(parentOption.untilSelector),
      selectorLabel: `Selector ${stepNumber}`,
    });
  }

  if (parentOption.mode === "traverse-until") {
    return buildTraverseUntilStepCode({
      stepNumber,
      functionName,
      inputNames,
      option: parentOption,
    });
  }

  return buildTraverseCountStepCode({
    functionName,
    inputNames,
    option: parentOption,
  });
};

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
  const stepNumber = startIndex + 1;
  const parentOption = getParentOption(step, parentOptions, defaultParentUntilSelector);
  const selectOption = getSelectElementOption(step, selectOptions);
  const builtStep = buildGeneratedStepCode({
    step,
    stepNumber,
    inputNames,
    parentOption,
    selectOption,
  });
  const { resultName, invocation } = buildInvocationLine(builtStep.functionName, inputSource);

  if (
    isObserverBoundaryStep({
      step,
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
    })
  ) {
    const runnerName = buildRunnerFunctionName(stepNumber);
    const runnerInputNames = getStepOutputNames({ step, inputNames });
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

const ensureClipboardVar = (lines: string[], state: CombinedRenderState) => {
  if (state.hasClipboardVar) {
    return state;
  }

  lines.push(`let ${clipboardHtmlName} = null`);
  return { ...state, hasClipboardVar: true };
};

const buildCombinedStepLines = ({
  step,
  stepNumber,
  parentOption,
  state,
}: {
  step: SupportedRecordStep;
  stepNumber: number;
  parentOption: ParentTraversalOption;
  state: CombinedRenderState;
}) => {
  const lines: string[] = [];
  let nextState = { ...state };

  if (step.kind === "select-element") {
    lines.push(
      ...buildSelectorLines({
        selectorName: `selector${stepNumber}`,
        selectorValue: resolveSelectElementSelector(step),
        selectorLabel: `Selector ${stepNumber}`,
      }),
    );
    const declaration = nextState.hasSelectedElementVar ? "" : "let ";
    lines.push(`${declaration}${stepInputOutputName} = await selector${stepNumber}.waitUntilMatch()`);
    nextState = { ...nextState, hasSelectedElementVar: true };
    return { lines, state: nextState };
  }

  if (step.kind === "delete-element") {
    lines.push(`if (${stepInputOutputName}) {`, `  ${stepInputOutputName}.remove()`, "}");
    return { lines, state: nextState };
  }

  if (step.kind === "click-element") {
    lines.push(`if (${stepInputOutputName}) {`, `  ${stepInputOutputName}.click()`, "}");
    return { lines, state: nextState };
  }

  if (step.kind === "cut-element") {
    nextState = ensureClipboardVar(lines, nextState);
    lines.push(
      `${clipboardHtmlName} = ${stepInputOutputName} ? ${stepInputOutputName}.outerHTML : null`,
      `if (${stepInputOutputName}) {`,
      `  ${stepInputOutputName}.remove()`,
      "}",
      `${stepInputOutputName} = null`,
    );
    return { lines, state: nextState };
  }

  if (step.kind === "copy-element") {
    nextState = ensureClipboardVar(lines, nextState);
    lines.push(`${clipboardHtmlName} = ${stepInputOutputName} ? ${stepInputOutputName}.outerHTML : null`);
    return { lines, state: nextState };
  }

  if (step.kind === "paste-element") {
    nextState = ensureClipboardVar(lines, nextState);
    lines.push(
      `if (${stepInputOutputName} && ${clipboardHtmlName}) {`,
      `  ${stepInputOutputName}.insertAdjacentHTML("afterend", ${clipboardHtmlName})`,
      "}",
    );
    return { lines, state: nextState };
  }

  if (step.kind === "apply-style-element") {
    const cssEntries = Object.entries(step.cssValues ?? {});
    if (cssEntries.length === 0) {
      lines.push("// Applied style (no CSS properties recorded)");
      return { lines, state: nextState };
    }

    lines.push(
      `if (${stepInputOutputName}) {`,
      `  ps.applyStyle([${stepInputOutputName}], {`,
      ...cssEntries.map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)},`),
      "  })",
      "}",
    );
    return { lines, state: nextState };
  }

  if (parentOption.mode === "traverse-until") {
    lines.push(
      ...buildSelectorLines({
        selectorName: `traverseUntilSelector${stepNumber}`,
        selectorValue: normalizeUntilSelector(parentOption.untilSelector),
        selectorLabel: `Traverse until selector ${stepNumber}`,
      }),
      `const nextSelectedElement${stepNumber} = ${stepInputOutputName}`,
      `  ? pq.traverseParents(${stepInputOutputName}, e => traverseUntilSelector${stepNumber}.matches(e))`,
      "  : null",
      `${stepInputOutputName} = nextSelectedElement${stepNumber}`,
    );
    return { lines, state: nextState };
  }

  const count = normalizeTraversalCount(parentOption.count);
  lines.push(
    `let nextSelectedElement${stepNumber} = ${stepInputOutputName}`,
    `const parentCount${stepNumber} = ${count}`,
    `for (let i = 0; i < parentCount${stepNumber}; i += 1) {`,
    `  if (!nextSelectedElement${stepNumber} || !nextSelectedElement${stepNumber}.parentElement) {`,
    `    nextSelectedElement${stepNumber} = null`,
    "    break",
    "  }",
    `  nextSelectedElement${stepNumber} = nextSelectedElement${stepNumber}.parentElement`,
    "}",
    `${stepInputOutputName} = nextSelectedElement${stepNumber}`,
  );
  return { lines, state: nextState };
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
}): CombinedRenderResult => {
  if (startIndex >= steps.length) {
    return { lines: [], state };
  }

  const step = steps[startIndex];
  const stepNumber = startIndex + 1;
  const parentOption = getParentOption(step, parentOptions, defaultParentUntilSelector);

  if (
    isObserverBoundaryStep({
      step,
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
    })
  ) {
    const selectorValue =
      step.kind === "select-element"
        ? resolveSelectElementSelector(step)
        : normalizeUntilSelector(parentOption.untilSelector);
    const nested = buildCombinedSequence({
      steps,
      startIndex: startIndex + 1,
      state: {
        hasSelectedElementVar: true,
        hasClipboardVar: state.hasClipboardVar,
      },
      parentOptions,
      selectOptions,
      defaultParentUntilSelector,
    });
    const callbackLines = [...nested.lines];

    return {
      lines: [
        ...buildSelectorLines({
          selectorName: `selector${stepNumber}`,
          selectorValue,
          selectorLabel: `Selector ${stepNumber}`,
        }),
        `selector${stepNumber}.onElementMatches(async (${stepInputOutputName}) => {`,
        ...indentLines(callbackLines),
        "})",
      ],
      state,
    };
  }

  const current = buildCombinedStepLines({
    step,
    stepNumber,
    parentOption,
    state,
  });
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

export const buildDefaultParentTraversalOption = (
  count: number,
  untilSelector = getSelectorFallback(),
): ParentTraversalOption => ({
  mode: "traverse-until",
  untilSelector: normalizeUntilSelector(untilSelector),
  count: Math.max(1, Math.floor(count)),
});

export const buildDefaultSelectElementOption = (): SelectElementOption => ({
  mode: "on-element-matches",
});

export const resolveDefaultParentUntilSelector = (steps: SupportedRecordStep[]) => {
  const selectedElementStep = steps.find((step) => step.kind === "select-element");
  if (!selectedElementStep) {
    return getSelectorFallback();
  }

  return resolveSelectElementSelector(selectedElementStep);
};

export const describeStepOption = (
  step: SupportedRecordStep,
  parentOptions: ParentTraversalOptionsByStepId,
  selectOptions: SelectElementOptionsByStepId = {},
) => {
  if (step.kind === "select-element") {
    const option = getSelectElementOption(step, selectOptions);
    return option.mode === "on-element-matches" ? "Select element: On element matches" : "Select element";
  }

  if (step.kind === "click-element") {
    return "Click element";
  }

  if (step.kind === "delete-element") {
    return "Delete element";
  }

  if (step.kind === "cut-element") {
    return "Cut element";
  }

  if (step.kind === "copy-element") {
    return "Copy element";
  }

  if (step.kind === "paste-element") {
    return "Paste element";
  }

  if (step.kind === "apply-style-element") {
    return "Apply style";
  }

  const option = parentOptions[step.id] ?? buildDefaultParentTraversalOption(step.count);
  if (option.mode === "selector-reselect") {
    return `Select parent element: Selector re-select (${normalizeUntilSelector(option.untilSelector)})`;
  }
  if (option.mode === "traverse-until") {
    return `Select parent element: Traverse until (${normalizeUntilSelector(option.untilSelector)})`;
  }

  return `Select parent element: Traverse n times (${normalizeTraversalCount(option.count)})`;
};

export const buildStepSnippet = (
  step: SupportedRecordStep,
  parentOptions: ParentTraversalOptionsByStepId,
  defaultParentUntilSelector = getSelectorFallback(),
  selectOptions: SelectElementOptionsByStepId = {},
) => {
  const stepNumber = parseStepNumber(step.id);
  const parentOption = getParentOption(step, parentOptions, defaultParentUntilSelector);
  const selectOption = getSelectElementOption(step, selectOptions);
  const inputNames = stepNumber === 1 ? [] : [stepInputOutputName];

  return buildGeneratedStepCode({
    step,
    stepNumber,
    inputNames,
    parentOption,
    selectOption,
  }).code;
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
  const rendered = buildFunctionsSequence({
    steps,
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

  return buildCombinedSequence({
    steps,
    startIndex: 0,
    state: {
      hasSelectedElementVar: false,
      hasClipboardVar: false,
    },
    parentOptions,
    selectOptions,
    defaultParentUntilSelector,
  }).lines.join("\n");
};

const resolveGeneratedCode = (rawCode: string, existingCode: string): GeneratedReviewCodeByModeEntry => {
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
  const resolvedDefaultParentUntilSelector = normalizeUntilSelector(defaultParentUntilSelector ?? getSelectorFallback());
  const byMode: Record<ReviewCodeMode, GeneratedReviewCodeByModeEntry> = {
    combined: resolveGeneratedCode(
      buildCombinedRawCode({
        steps,
        parentOptions,
        selectOptions,
        defaultParentUntilSelector: resolvedDefaultParentUntilSelector,
      }),
      existingCode,
    ),
    functions: resolveGeneratedCode(
      buildFunctionsRawCode({
        steps,
        parentOptions,
        selectOptions,
        defaultParentUntilSelector: resolvedDefaultParentUntilSelector,
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
