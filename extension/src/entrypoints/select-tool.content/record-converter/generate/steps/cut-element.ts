import type { SupportedRecordStep } from "../../normalize";
import type { BuiltStepCode, CombinedLinesContext, CombinedLinesResult, FunctionCodeContext, StepGenerator } from "../types";
import { buildStepFunctionCode, clipboardHtmlName, ensureClipboardVar, getPassthroughExtras, stepInputOutputName } from "../utils";

export class CutElementStep implements StepGenerator {
  constructor(_step: SupportedRecordStep) {}

  buildFunctionCode({ functionName, inputNames }: FunctionCodeContext): BuiltStepCode {
    const el = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
    const extras = getPassthroughExtras(inputNames, stepInputOutputName, clipboardHtmlName);
    return {
      functionName,
      inputNames,
      code: buildStepFunctionCode({
        functionName,
        inputNames,
        bodyLines: [
          `const ${clipboardHtmlName} = ${el}.outerHTML`,
          `${el}.remove()`,
        ],
        outputs: [
          { name: stepInputOutputName, expression: "null" },
          { name: clipboardHtmlName, expression: clipboardHtmlName },
          ...extras.map((name) => ({ name, expression: name })),
        ],
      }),
      outputNames: [stepInputOutputName, clipboardHtmlName, ...extras],
    };
  }

  buildCombinedLines({ state }: CombinedLinesContext): CombinedLinesResult {
    const lines: string[] = [];
    const nextState = ensureClipboardVar(lines, state);
    lines.push(
      `${clipboardHtmlName} = ${stepInputOutputName}.outerHTML`,
      `${stepInputOutputName}.remove()`,
      `${stepInputOutputName} = null`,
    );
    return { lines, state: nextState };
  }

  getOutputNames(inputNames: string[]): string[] {
    return [stepInputOutputName, clipboardHtmlName, ...getPassthroughExtras(inputNames, stepInputOutputName, clipboardHtmlName)];
  }

  isObserverBoundary(): boolean {
    return false;
  }

  describe(): string {
    return "Cut element";
  }
}
