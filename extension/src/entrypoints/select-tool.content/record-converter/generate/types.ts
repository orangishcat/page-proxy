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
  readonly resetTopLevel?: boolean;
  buildFunctionCode(ctx: FunctionCodeContext): BuiltStepCode;
  buildCombinedLines(ctx: CombinedLinesContext): CombinedLinesResult;
  buildCombinedObserverLines?(ctx: CombinedObserverContext): string[];
  getOutputNames(inputNames: string[]): string[];
  isObserverBoundary(): boolean;
  describe(): string;
}

export type ModeImpl = {
  resetTopLevel?: boolean;
  buildFunctionCode(step: SupportedRecordStep, ctx: FunctionCodeContext): BuiltStepCode;
  buildCombinedLines(step: SupportedRecordStep, ctx: CombinedLinesContext): CombinedLinesResult;
  buildCombinedObserverLines?(step: SupportedRecordStep, ctx: CombinedObserverContext): string[];
  getOutputNames(step: SupportedRecordStep, inputNames: string[]): string[];
  isObserverBoundary: boolean;
  describe(step: SupportedRecordStep): string;
};

export class ModeBasedStep implements StepGenerator {
  constructor(
    private readonly step: SupportedRecordStep,
    private readonly impl: ModeImpl,
  ) {}

  get resetTopLevel(): boolean {
    return this.impl.resetTopLevel ?? false;
  }

  buildFunctionCode(ctx: FunctionCodeContext): BuiltStepCode {
    return this.impl.buildFunctionCode(this.step, ctx);
  }

  buildCombinedLines(ctx: CombinedLinesContext): CombinedLinesResult {
    return this.impl.buildCombinedLines(this.step, ctx);
  }

  buildCombinedObserverLines(ctx: CombinedObserverContext): string[] {
    return this.impl.buildCombinedObserverLines!(this.step, ctx);
  }

  getOutputNames(inputNames: string[]): string[] {
    return this.impl.getOutputNames(this.step, inputNames);
  }

  isObserverBoundary(): boolean {
    return this.impl.isObserverBoundary;
  }

  describe(): string {
    return this.impl.describe(this.step);
  }
}
