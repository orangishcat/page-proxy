import type { SupportedRecordStep } from "../../normalize";
import type { BuiltStepCode, CombinedLinesContext, CombinedLinesResult, FunctionCodeContext, StepGenerator } from "../types";
import { buildStepFunctionCode, stepInputOutputName } from "../utils";

export class DeleteElementStep implements StepGenerator {
  constructor(_step: SupportedRecordStep) {}

  buildFunctionCode({ functionName, inputNames }: FunctionCodeContext): BuiltStepCode {
    const el = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
    return {
      functionName,
      inputNames,
      code: buildStepFunctionCode({
        functionName,
        inputNames,
        bodyLines: [`${el}.remove()`],
        outputs: [],
      }),
      outputNames: [],
    };
  }

  buildCombinedLines({ state }: CombinedLinesContext): CombinedLinesResult {
    return {
      lines: [`${stepInputOutputName}.remove()`],
      state,
    };
  }

  getOutputNames(): string[] {
    return [];
  }

  isObserverBoundary(): boolean {
    return false;
  }

  describe(): string {
    return "Delete element";
  }
}
