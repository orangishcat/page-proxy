import { resolveRecordConverterCollisions } from "./collision";
import type { SupportedRecordStep } from "./normalize";
import { getSelectorFallback } from "../popup/selector";

export type ParentTraversalMode = "traverse-until" | "traverse-n-times";

export type ParentTraversalOption = {
  mode: ParentTraversalMode;
  untilSelector: string;
  count: number;
};

export type ParentTraversalOptionsByStepId = Record<string, ParentTraversalOption>;
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

const stepInputOutputName = "selectedElement";

const toStringLiteral = (value: string) => JSON.stringify(value);

const resolveSelectElementSelector = (step: SupportedRecordStep) => {
  return step.selectorHint && step.selectorHint.trim().length > 0
    ? step.selectorHint.trim()
    : getSelectorFallback();
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
const toNextSelectedElementName = () => `next${stepInputOutputName[0].toUpperCase()}${stepInputOutputName.slice(1)}`;

const buildFunctionParameters = (inputNames: string[]) => {
  if (inputNames.length === 0) {
    return "";
  }
  return inputNames.join(", ");
};

type StepOutputBinding = {
  name: string;
  expression: string;
};

const buildReturnLine = (outputs: StepOutputBinding[]) => {
  if (outputs.length === 0) {
    return "  return []";
  }

  const outputExpressions = outputs.map((output) => output.expression);
  return `  return [${outputExpressions.join(", ")}]`;
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

export const buildDefaultParentTraversalOption = (count: number, untilSelector = getSelectorFallback()): ParentTraversalOption => ({
  mode: "traverse-until",
  untilSelector: normalizeUntilSelector(untilSelector),
  count: Math.max(1, Math.floor(count)),
});

export const resolveDefaultParentUntilSelector = (steps: SupportedRecordStep[]) => {
  const selectedElementStep = steps.find((step) => step.kind === "select-element");
  if (!selectedElementStep) {
    return getSelectorFallback();
  }

  return resolveSelectElementSelector(selectedElementStep);
};

export const describeStepOption = (step: SupportedRecordStep, parentOptions: ParentTraversalOptionsByStepId) => {
  if (step.kind === "select-element") {
    return "Select element";
  }
  if (step.kind === "delete-element") {
    return "Delete element";
  }

  const option = parentOptions[step.id] ?? buildDefaultParentTraversalOption(step.count);
  if (option.mode === "traverse-until") {
    return `Select parent element: Traverse until (${normalizeUntilSelector(option.untilSelector)})`;
  }

  return `Select parent element: Traverse n times (${normalizeTraversalCount(option.count)})`;
};

type BuiltStepCode = {
  functionName: string;
  inputNames: string[];
  code: string;
  outputNames: string[];
};

const buildSelectElementStepCode = ({
  step,
  stepNumber,
  functionName,
  inputNames,
}: {
  step: SupportedRecordStep;
  stepNumber: number;
  functionName: string;
  inputNames: string[];
}): BuiltStepCode => {
  const selectorValue = resolveSelectElementSelector(step);

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines: [
        "const selector = pq.selector({",
        `  name: ${toStringLiteral(`Selector ${stepNumber}`)},`,
        `  baseSelector: ${toStringLiteral(selectorValue)},`,
        "  matches: e => true",
        "})",
        `const ${stepInputOutputName} = await selector.waitUntilMatch()`,
      ],
      outputs: [{ name: stepInputOutputName, expression: stepInputOutputName }],
    }),
    outputNames: [stepInputOutputName],
  };
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
}): BuiltStepCode => {
  const untilSelector = normalizeUntilSelector(option.untilSelector);
  const selectedElementInput = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
  const nextElementName = toNextSelectedElementName();

  return {
    functionName,
    inputNames,
    code: buildStepFunctionCode({
      functionName,
      inputNames,
      bodyLines: [
        "const traverseUntilSelector = pq.selector({",
        `  name: ${toStringLiteral(`Traverse until selector ${stepNumber}`)},`,
        `  baseSelector: ${toStringLiteral(untilSelector)},`,
        "  matches: e => true",
        "})",
        `const ${nextElementName} = ${selectedElementInput}`,
        `  ? pq.traverseParents(${selectedElementInput}, e => traverseUntilSelector.matches(e))`,
        "  : null",
      ],
      outputs: [
        {
          name: stepInputOutputName,
          expression: nextElementName,
        },
      ],
    }),
    outputNames: [stepInputOutputName],
  };
};

const buildTraverseCountStepCode = ({
  functionName,
  inputNames,
  option,
}: {
  functionName: string;
  inputNames: string[];
  option: ParentTraversalOption;
}): BuiltStepCode => {
  const count = normalizeTraversalCount(option.count);
  const nextElementName = toNextSelectedElementName();
  const selectedElementInput = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";

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
        {
          name: stepInputOutputName,
          expression: nextElementName,
        },
      ],
    }),
    outputNames: [stepInputOutputName],
  };
};

const buildDeleteStepCode = ({ functionName, inputNames }: { functionName: string; inputNames: string[] }): BuiltStepCode => {
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
  };
};

const buildStepCode = ({
  step,
  stepNumber,
  parentOption,
  inputNames,
}: {
  step: SupportedRecordStep;
  stepNumber: number;
  parentOption: ParentTraversalOption;
  inputNames: string[];
}): BuiltStepCode => {
  const functionName = buildStepFunctionName(stepNumber);

  if (step.kind === "select-element") {
    return buildSelectElementStepCode({
      step,
      stepNumber,
      functionName,
      inputNames,
    });
  }

  if (step.kind === "delete-element") {
    return buildDeleteStepCode({ functionName, inputNames });
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

export const buildStepSnippet = (
  step: SupportedRecordStep,
  parentOptions: ParentTraversalOptionsByStepId,
  defaultParentUntilSelector = getSelectorFallback(),
) => {
  const stepNumber = parseStepNumber(step.id);
  const parentOption = parentOptions[step.id] ?? buildDefaultParentTraversalOption(step.count, defaultParentUntilSelector);
  const inputNames = stepNumber === 1 ? [] : [stepInputOutputName];

  return buildStepCode({
    step,
    stepNumber,
    parentOption,
    inputNames,
  }).code;
};

const buildFunctionsRawCode = ({
  steps,
  parentOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  parentOptions: ParentTraversalOptionsByStepId;
  defaultParentUntilSelector: string;
}) => {
  let previousStepOutputs: string[] = [];

  const builtSteps = steps.map((step, stepIndex) => {
    const stepNumber = stepIndex + 1;
    const parentOption =
      parentOptions[step.id] ?? buildDefaultParentTraversalOption(step.count, defaultParentUntilSelector);
    const inputNames = stepNumber === 1 ? [] : previousStepOutputs;
    const builtStep = buildStepCode({
      step,
      stepNumber,
      parentOption,
      inputNames,
    });
    previousStepOutputs = builtStep.outputNames;
    return builtStep;
  });

  const functionDefinitions = builtSteps.map((stepCode) => stepCode.code).join("\n\n");

  let previousResultName = "";
  const invocationLines = builtSteps.map((stepCode) => {
    const resultName = `${stepCode.functionName}Result`;
    const invocationLine =
      stepCode.inputNames.length === 0
        ? `const ${resultName} = await ${stepCode.functionName}()`
        : previousResultName.trim().length > 0
          ? `const ${resultName} = await ${stepCode.functionName}(...${previousResultName})`
          : `const ${resultName} = await ${stepCode.functionName}()`;
    previousResultName = resultName;
    return invocationLine;
  });

  const invocationCode =
    invocationLines.length === 0
      ? ""
      : invocationLines.join("\n");

  return [functionDefinitions, invocationCode].filter((section) => section.trim().length > 0).join("\n\n");
};

const buildCombinedStepLines = ({
  step,
  stepNumber,
  parentOption,
}: {
  step: SupportedRecordStep;
  stepNumber: number;
  parentOption: ParentTraversalOption;
}) => {
  if (step.kind === "select-element") {
    const selectorValue = resolveSelectElementSelector(step);
    const selectorName = `selector${stepNumber}`;
    return [
      `  const ${selectorName} = pq.selector({`,
      `    name: ${toStringLiteral(`Selector ${stepNumber}`)},`,
      `    baseSelector: ${toStringLiteral(selectorValue)},`,
      "    matches: e => true",
      "  })",
      `  ${stepInputOutputName} = await ${selectorName}.waitUntilMatch()`,
    ];
  }

  if (step.kind === "delete-element") {
    return [`  if (${stepInputOutputName}) {`, `    ${stepInputOutputName}.remove()`, "  }"];
  }

  if (parentOption.mode === "traverse-until") {
    const untilSelector = normalizeUntilSelector(parentOption.untilSelector);
    const selectorName = `traverseUntilSelector${stepNumber}`;
    const nextElementName = `nextSelectedElement${stepNumber}`;
    return [
      `  const ${selectorName} = pq.selector({`,
      `    name: ${toStringLiteral(`Traverse until selector ${stepNumber}`)},`,
      `    baseSelector: ${toStringLiteral(untilSelector)},`,
      "    matches: e => true",
      "  })",
      `  const ${nextElementName} = ${stepInputOutputName}`,
      `    ? pq.traverseParents(${stepInputOutputName}, e => ${selectorName}.matches(e))`,
      "    : null",
      `  ${stepInputOutputName} = ${nextElementName}`,
    ];
  }

  const count = normalizeTraversalCount(parentOption.count);
  const nextElementName = `nextSelectedElement${stepNumber}`;
  const parentCountName = `parentCount${stepNumber}`;
  return [
    `  let ${nextElementName} = ${stepInputOutputName}`,
    `  const ${parentCountName} = ${count}`,
    `  for (let i = 0; i < ${parentCountName}; i += 1) {`,
    `    if (!${nextElementName} || !${nextElementName}.parentElement) {`,
    `      ${nextElementName} = null`,
    "      break",
    "    }",
    `    ${nextElementName} = ${nextElementName}.parentElement`,
    "  }",
    `  ${stepInputOutputName} = ${nextElementName}`,
  ];
};

const buildCombinedRawCode = ({
  steps,
  parentOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  parentOptions: ParentTraversalOptionsByStepId;
  defaultParentUntilSelector: string;
}) => {
  if (steps.length === 0) {
    return "";
  }

  const lines = [`let ${stepInputOutputName} = null`];
  steps.forEach((step, stepIndex) => {
    const stepNumber = stepIndex + 1;
    const parentOption =
      parentOptions[step.id] ?? buildDefaultParentTraversalOption(step.count, defaultParentUntilSelector);
    lines.push(...buildCombinedStepLines({ step, stepNumber, parentOption }));
  });
  return lines.join("\n");
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
  existingCode,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  parentOptions: ParentTraversalOptionsByStepId;
  existingCode: string;
  defaultParentUntilSelector?: string;
}): GeneratedReviewCode => {
  const resolvedDefaultParentUntilSelector = normalizeUntilSelector(defaultParentUntilSelector ?? getSelectorFallback());
  const byMode: Record<ReviewCodeMode, GeneratedReviewCodeByModeEntry> = {
    combined: resolveGeneratedCode(
      buildCombinedRawCode({ steps, parentOptions, defaultParentUntilSelector: resolvedDefaultParentUntilSelector }),
      existingCode,
    ),
    functions: resolveGeneratedCode(
      buildFunctionsRawCode({ steps, parentOptions, defaultParentUntilSelector: resolvedDefaultParentUntilSelector }),
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
