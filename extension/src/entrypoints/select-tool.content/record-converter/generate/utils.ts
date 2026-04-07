import { getSelectorFallback } from "../../popup/selector";
import type { SupportedRecordStep } from "../normalize";
import type {
  CombinedRenderState,
  ParentTraversalOption,
  ParentTraversalOptionsByStepId,
  SelectElementOption,
  SelectElementOptionsByStepId,
  StepOutputBinding,
} from "./types";

export const stepInputOutputName = "selectedElement";
export const clipboardHtmlName = "clipboardHtml";

export const getPassthroughExtras = (inputNames: string[], ...exclude: string[]) =>
  inputNames.filter((name) => !exclude.includes(name));

export const toStringLiteral = (value: string) => JSON.stringify(value);

export const resolveSelectElementSelector = (step: SupportedRecordStep) =>
  step.selectorHint && step.selectorHint.trim().length > 0 ? step.selectorHint.trim() : getSelectorFallback();

export const normalizeTraversalCount = (count: number) =>
  Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;

export const normalizeUntilSelector = (value: string) => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : getSelectorFallback();
};

export const parseStepNumber = (stepId: string) => {
  const parsed = Number.parseInt(stepId.replace("step-", ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export const buildStepFunctionName = (stepNumber: number) => `step${stepNumber}`;
export const buildRunnerFunctionName = (stepNumber: number) => `runAfterStep${stepNumber}`;
export const toNextSelectedElementName = () =>
  `next${stepInputOutputName[0].toUpperCase()}${stepInputOutputName.slice(1)}`;

export const buildFunctionParameters = (inputNames: string[]) => {
  if (inputNames.length === 0) {
    return "";
  }
  return inputNames.join(", ");
};

export const buildReturnLine = (outputs: StepOutputBinding[]) => {
  if (outputs.length === 0) {
    return "  return []";
  }
  return `  return [${outputs.map((output) => output.expression).join(", ")}]`;
};

export const buildStepFunctionCode = ({
  functionName,
  inputNames,
  bodyLines,
  outputs,
}: {
  functionName: string;
  inputNames: string[];
  bodyLines: string[];
  outputs: StepOutputBinding[];
}) =>
  [
    `async function ${functionName}(${buildFunctionParameters(inputNames)}) {`,
    ...bodyLines.map((line) => `  ${line}`),
    buildReturnLine(outputs),
    "}",
  ].join("\n");

export const indentLines = (lines: string[], prefix = "  ") => lines.map((line) => `${prefix}${line}`);

export const buildInvocationLine = (functionName: string, inputSource: string | null) => {
  const resultName = `${functionName}Result`;
  const invocation =
    inputSource && inputSource.trim().length > 0
      ? `const ${resultName} = await ${functionName}(...${inputSource})`
      : `const ${resultName} = await ${functionName}()`;
  return { resultName, invocation };
};

export const buildSelectorLines = ({
  selectorName,
  selectorValue,
}: {
  selectorName: string;
  selectorValue: string;
}) => [
  `const ${selectorName} = pq.selector({`,
  `  baseSelector: ${toStringLiteral(selectorValue)},`,
  "  matches: e => true",
  "})",
];

export const ensureClipboardVar = (lines: string[], state: CombinedRenderState): CombinedRenderState => {
  if (state.hasClipboardVar) {
    return state;
  }
  lines.push(`let ${clipboardHtmlName} = null`);
  return { ...state, hasClipboardVar: true };
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

export const getSelectElementOption = (
  step: SupportedRecordStep,
  selectOptions: SelectElementOptionsByStepId,
): SelectElementOption =>
  step.kind === "select-element" ? (selectOptions[step.id] ?? buildDefaultSelectElementOption()) : buildDefaultSelectElementOption();

export const getParentOption = (
  step: SupportedRecordStep,
  parentOptions: ParentTraversalOptionsByStepId,
  defaultParentUntilSelector: string,
): ParentTraversalOption =>
  parentOptions[step.id] ?? buildDefaultParentTraversalOption(step.count, defaultParentUntilSelector);

export const resolveDefaultParentUntilSelector = (steps: SupportedRecordStep[]) => {
  const selectedElementStep = steps.find((step) => step.kind === "select-element");
  if (!selectedElementStep) {
    return getSelectorFallback();
  }
  return resolveSelectElementSelector(selectedElementStep);
};
