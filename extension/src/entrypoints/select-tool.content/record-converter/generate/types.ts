import type { SupportedRecordStep } from "../normalize";

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

export type GeneratedReviewCodeByModeEntry = {
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

export type StepOutputBinding = {
  name: string;
  expression: string;
};

export type BuiltStepCode = {
  functionName: string;
  inputNames: string[];
  code: string;
  outputNames: string[];
};

export type CombinedRenderState = {
  hasSelectedElementVar: boolean;
  hasClipboardVar: boolean;
};

export type FunctionsRenderResult = {
  definitions: string[];
  invocations: string[];
};

export type FunctionCodeContext = {
  functionName: string;
  inputNames: string[];
  stepNumber: number;
};

export type CombinedLinesContext = {
  stepNumber: number;
  state: CombinedRenderState;
};

export type CombinedObserverContext = {
  stepNumber: number;
  callbackLines: string[];
};

export type CombinedLinesResult = {
  lines: string[];
  state: CombinedRenderState;
};

export interface StepGenerator {
  buildFunctionCode(ctx: FunctionCodeContext): BuiltStepCode;
  buildCombinedLines(ctx: CombinedLinesContext): CombinedLinesResult;
  buildCombinedObserverLines?(ctx: CombinedObserverContext): string[];
  getOutputNames(inputNames: string[]): string[];
  isObserverBoundary(): boolean;
  describe(): string;
}

export type ModeImpl<TStep extends SupportedRecordStep = SupportedRecordStep> = {
  buildFunctionCode(step: TStep, ctx: FunctionCodeContext): BuiltStepCode;
  buildCombinedLines(step: TStep, ctx: CombinedLinesContext): CombinedLinesResult;
  buildCombinedObserverLines?(step: TStep, ctx: CombinedObserverContext): string[];
  getOutputNames(step: TStep, inputNames: string[]): string[];
  isObserverBoundary: boolean;
  describe(step: TStep): string;
};
