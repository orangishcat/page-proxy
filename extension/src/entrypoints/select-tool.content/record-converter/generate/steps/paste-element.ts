import type { SupportedRecordStep } from "../../normalize";
import type { BuiltStepCode, CombinedLinesContext, CombinedLinesResult, FunctionCodeContext, StepGenerator } from "../types";
import { buildStepFunctionCode, clipboardHtmlName, ensureClipboardVar, getPassthroughExtras, stepInputOutputName } from "../utils";

export class PasteElementStep implements StepGenerator {
  constructor(_step: SupportedRecordStep) {}

  buildFunctionCode({ functionName, inputNames }: FunctionCodeContext): BuiltStepCode {
    const el = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
    const extras = getPassthroughExtras(inputNames, stepInputOutputName, clipboardHtmlName);
    const functionInputNames = inputNames.includes(clipboardHtmlName) ? inputNames : [...inputNames, clipboardHtmlName];
    return {
      functionName,
      inputNames: functionInputNames,
      code: buildStepFunctionCode({
        functionName,
        inputNames: functionInputNames,
        bodyLines: [
          `if (${el} && ${clipboardHtmlName}) {`,
          `  ${el}.insertAdjacentHTML("afterend", ${clipboardHtmlName})`,
          "}",
        ],
        outputs: [
          { name: stepInputOutputName, expression: el },
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
      `if (${stepInputOutputName} && ${clipboardHtmlName}) {`,
      `  ${stepInputOutputName}.insertAdjacentHTML("afterend", ${clipboardHtmlName})`,
      "}",
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
    return "Paste element";
  }
}
