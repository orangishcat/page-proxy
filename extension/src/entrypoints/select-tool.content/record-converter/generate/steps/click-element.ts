import type { SupportedRecordStep } from "../../normalize";
import type { BuiltStepCode, CombinedLinesContext, CombinedLinesResult, FunctionCodeContext, StepGenerator } from "../types";
import { buildStepFunctionCode, getPassthroughExtras, stepInputOutputName } from "../utils";

export class ClickElementStep implements StepGenerator {
  constructor(_step: SupportedRecordStep) {}

  buildFunctionCode({ functionName, inputNames }: FunctionCodeContext): BuiltStepCode {
    const el = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
    const extras = getPassthroughExtras(inputNames, stepInputOutputName);
    return {
      functionName,
      inputNames,
      code: buildStepFunctionCode({
        functionName,
        inputNames,
        bodyLines: [`${el}.click()`],
        outputs: [
          { name: stepInputOutputName, expression: el },
          ...extras.map((name) => ({ name, expression: name })),
        ],
      }),
      outputNames: [stepInputOutputName, ...extras],
    };
  }

  buildCombinedLines({ state }: CombinedLinesContext): CombinedLinesResult {
    return {
      lines: [`${stepInputOutputName}.click()`],
      state,
    };
  }

  getOutputNames(inputNames: string[]): string[] {
    return [stepInputOutputName, ...getPassthroughExtras(inputNames, stepInputOutputName)];
  }

  isObserverBoundary(): boolean {
    return false;
  }

  describe(): string {
    return "Click element";
  }
}
