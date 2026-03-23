import type { SupportedRecordStep } from "../../normalize";
import type {
  BuiltStepCode,
  CombinedLinesContext,
  CombinedLinesResult,
  CombinedObserverContext,
  FunctionCodeContext,
  ModeImpl,
  SelectElementMode,
  SelectElementOption,
  StepGenerator,
} from "../types";
import {
  buildRunnerFunctionName,
  buildSelectorLines,
  buildStepFunctionCode,
  getPassthroughExtras,
  indentLines,
  resolveSelectElementSelector,
  stepInputOutputName,
} from "../utils";

const modeImpls: Record<SelectElementMode, ModeImpl> = {
  "wait-until-match": {
    isObserverBoundary: false,

    buildFunctionCode(step, { functionName, inputNames, stepNumber }) {
      const selectorValue = resolveSelectElementSelector(step);
      const extras = getPassthroughExtras(inputNames, stepInputOutputName);
      const assignmentLine = inputNames.includes(stepInputOutputName)
        ? `${stepInputOutputName} = await selector.waitUntilMatch()`
        : `let ${stepInputOutputName} = await selector.waitUntilMatch()`;
      return {
        functionName,
        inputNames,
        code: buildStepFunctionCode({
          functionName,
          inputNames,
          bodyLines: [
            ...buildSelectorLines({ selectorName: "selector", selectorValue, selectorLabel: `Selector ${stepNumber}` }),
            assignmentLine,
          ],
          outputs: [
            { name: stepInputOutputName, expression: stepInputOutputName },
            ...extras.map((name) => ({ name, expression: name })),
          ],
        }),
        outputNames: [stepInputOutputName, ...extras],
      };
    },

    buildCombinedLines(step, { stepNumber, state }) {
      const lines: string[] = [];
      lines.push(
        ...buildSelectorLines({
          selectorName: `selector${stepNumber}`,
          selectorValue: resolveSelectElementSelector(step),
          selectorLabel: `Selector ${stepNumber}`,
        }),
      );
      const declaration = state.hasSelectedElementVar ? "" : "let ";
      lines.push(`${declaration}${stepInputOutputName} = await selector${stepNumber}.waitUntilMatch()`);
      return { lines, state: { ...state, hasSelectedElementVar: true } };
    },

    getOutputNames(_step, inputNames) {
      return [stepInputOutputName, ...getPassthroughExtras(inputNames, stepInputOutputName)];
    },

    describe() {
      return "Select element";
    },
  },

  "on-element-matches": {
    isObserverBoundary: true,

    buildFunctionCode(step, { functionName, inputNames, stepNumber }) {
      const selectorValue = resolveSelectElementSelector(step);
      const extras = getPassthroughExtras(inputNames, stepInputOutputName);
      const runnerName = buildRunnerFunctionName(stepNumber);
      const callbackArgs = [stepInputOutputName, ...extras];
      return {
        functionName,
        inputNames,
        code: buildStepFunctionCode({
          functionName,
          inputNames,
          bodyLines: [
            ...buildSelectorLines({ selectorName: "selector", selectorValue, selectorLabel: `Selector ${stepNumber}` }),
            `selector.onElementMatches((${stepInputOutputName}) => {`,
            `  void ${runnerName}(${callbackArgs.join(", ")})`,
            "})",
          ],
          outputs: [],
        }),
        outputNames: [stepInputOutputName, ...extras],
      };
    },

    buildCombinedLines(_step, { state }) {
      return { lines: [], state };
    },

    buildCombinedObserverLines(step, { stepNumber, callbackLines }) {
      return [
        ...buildSelectorLines({
          selectorName: `selector${stepNumber}`,
          selectorValue: resolveSelectElementSelector(step),
          selectorLabel: `Selector ${stepNumber}`,
        }),
        `selector${stepNumber}.onElementMatches(async (${stepInputOutputName}) => {`,
        ...indentLines(callbackLines),
        "})",
      ];
    },

    getOutputNames(_step, inputNames) {
      return [stepInputOutputName, ...getPassthroughExtras(inputNames, stepInputOutputName)];
    },

    describe() {
      return "Select element: On element matches";
    },
  },
};

export class SelectElementStep implements StepGenerator {
  private readonly impl: ModeImpl;

  constructor(
    private step: SupportedRecordStep,
    option: SelectElementOption,
  ) {
    this.impl = modeImpls[option.mode];
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
