import type { SupportedRecordStep } from "../../normalize";
import type { BuiltStepCode, CombinedLinesContext, CombinedLinesResult, FunctionCodeContext, StepGenerator } from "../types";
import { buildStepFunctionCode, getPassthroughExtras, stepInputOutputName } from "../utils";

export class ApplyStyleElementStep implements StepGenerator {
  constructor(private step: SupportedRecordStep) {}

  buildFunctionCode({ functionName, inputNames }: FunctionCodeContext): BuiltStepCode {
    const el = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
    const extras = getPassthroughExtras(inputNames, stepInputOutputName);
    const cssEntries = Object.entries(this.step.cssValues ?? {});
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
    };
  }

  buildCombinedLines({ state }: CombinedLinesContext): CombinedLinesResult {
    const cssEntries = Object.entries(this.step.cssValues ?? {});
    if (cssEntries.length === 0) {
      return { lines: ["// Applied style (no CSS properties recorded)"], state };
    }
    return {
      lines: [
        `if (${stepInputOutputName}) {`,
        `  ps.applyStyle([${stepInputOutputName}], {`,
        ...cssEntries.map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)},`),
        "  })",
        "}",
      ],
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
    return "Apply style";
  }
}
