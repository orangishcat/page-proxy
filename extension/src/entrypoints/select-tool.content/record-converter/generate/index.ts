import { getSelectorFallback } from "../../popup/selector";
import type { SupportedRecordStep } from "../normalize";
import { createStep } from "./step-factory";
import type { ParentTraversalOptionsByStepId, SelectElementOptionsByStepId } from "./types";
import {
  buildStepFunctionName,
  getParentOption,
  getSelectElementOption,
  parseStepNumber,
  stepInputOutputName,
} from "./utils";

export type {
  GeneratedReviewCode,
  GeneratedReviewCodeByModeEntry,
  ParentTraversalMode,
  ParentTraversalOption,
  ParentTraversalOptionsByStepId,
  ReviewCodeMode,
  SelectElementMode,
  SelectElementOption,
  SelectElementOptionsByStepId,
} from "./types";

export { buildGeneratedReviewCode } from "./sequence";

export { buildDefaultParentTraversalOption, buildDefaultSelectElementOption, resolveDefaultParentUntilSelector } from "./utils";

export const isObserverBoundaryStep = ({
  step,
  parentOptions,
  selectOptions = {},
  defaultParentUntilSelector,
}: {
  step: SupportedRecordStep;
  parentOptions: ParentTraversalOptionsByStepId;
  selectOptions?: SelectElementOptionsByStepId;
  defaultParentUntilSelector: string;
}): boolean => {
  const parentOption = getParentOption(step, parentOptions, defaultParentUntilSelector);
  const selectOption = getSelectElementOption(step, selectOptions);
  return createStep(step, parentOption, selectOption).isObserverBoundary();
};

export const describeStepOption = (
  step: SupportedRecordStep,
  parentOptions: ParentTraversalOptionsByStepId,
  selectOptions: SelectElementOptionsByStepId = {},
): string => {
  const parentOption = getParentOption(step, parentOptions, getSelectorFallback());
  const selectOption = getSelectElementOption(step, selectOptions);
  return createStep(step, parentOption, selectOption).describe();
};

export const buildStepSnippet = (
  step: SupportedRecordStep,
  parentOptions: ParentTraversalOptionsByStepId,
  defaultParentUntilSelector = getSelectorFallback(),
  selectOptions: SelectElementOptionsByStepId = {},
): string => {
  const stepNumber = parseStepNumber(step.id);
  const functionName = buildStepFunctionName(stepNumber);
  const parentOption = getParentOption(step, parentOptions, defaultParentUntilSelector);
  const selectOption = getSelectElementOption(step, selectOptions);
  const inputNames = stepNumber === 1 ? [] : [stepInputOutputName];
  return createStep(step, parentOption, selectOption).buildFunctionCode({ functionName, inputNames, stepNumber }).code;
};

