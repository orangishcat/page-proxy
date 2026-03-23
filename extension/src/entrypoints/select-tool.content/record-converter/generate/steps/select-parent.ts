import type { SupportedRecordStep } from "../../normalize";
import type {
  BuiltStepCode,
  CombinedLinesContext,
  CombinedLinesResult,
  CombinedObserverContext,
  FunctionCodeContext,
  ParentTraversalMode,
  ParentTraversalOption,
  StepGenerator,
} from "../types";
import {
  buildRunnerFunctionName,
  buildSelectorLines,
  buildStepFunctionCode,
  getPassthroughExtras,
  indentLines,
  normalizeTraversalCount,
  normalizeUntilSelector,
  stepInputOutputName,
  toNextSelectedElementName,
} from "../utils";

type ParentModeImpl = {
  isObserverBoundary: boolean;
  buildFunctionCode(step: SupportedRecordStep, option: ParentTraversalOption, ctx: FunctionCodeContext): BuiltStepCode;
  buildCombinedLines(step: SupportedRecordStep, option: ParentTraversalOption, ctx: CombinedLinesContext): CombinedLinesResult;
  buildCombinedObserverLines?(step: SupportedRecordStep, option: ParentTraversalOption, ctx: CombinedObserverContext): string[];
  getOutputNames(inputNames: string[]): string[];
  describe(option: ParentTraversalOption): string;
};

const modeImpls: Record<ParentTraversalMode, ParentModeImpl> = {
  "traverse-until": {
    isObserverBoundary: false,

    buildFunctionCode(_step, option, { functionName, inputNames, stepNumber }) {
      const untilSelector = normalizeUntilSelector(option.untilSelector);
      const selectedElementInput = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
      const nextElementName = toNextSelectedElementName();
      const extras = getPassthroughExtras(inputNames, stepInputOutputName);
      return {
        functionName,
        inputNames,
        code: buildStepFunctionCode({
          functionName,
          inputNames,
          bodyLines: [
            ...buildSelectorLines({
              selectorName: "traverseUntilSelector",
              selectorValue: untilSelector,
              selectorLabel: `Traverse until selector ${stepNumber}`,
            }),
            `const ${nextElementName} = ${selectedElementInput}`,
            `  ? pq.traverseParents(${selectedElementInput}, e => traverseUntilSelector.matches(e))`,
            "  : null",
          ],
          outputs: [
            { name: stepInputOutputName, expression: nextElementName },
            ...extras.map((name) => ({ name, expression: name })),
          ],
        }),
        outputNames: [stepInputOutputName, ...extras],
      };
    },

    buildCombinedLines(_step, option, { stepNumber, state }) {
      const untilSelector = normalizeUntilSelector(option.untilSelector);
      return {
        lines: [
          ...buildSelectorLines({
            selectorName: `traverseUntilSelector${stepNumber}`,
            selectorValue: untilSelector,
            selectorLabel: `Traverse until selector ${stepNumber}`,
          }),
          `const nextSelectedElement${stepNumber} = ${stepInputOutputName}`,
          `  ? pq.traverseParents(${stepInputOutputName}, e => traverseUntilSelector${stepNumber}.matches(e))`,
          "  : null",
          `${stepInputOutputName} = nextSelectedElement${stepNumber}`,
        ],
        state,
      };
    },

    getOutputNames(inputNames) {
      return [stepInputOutputName, ...getPassthroughExtras(inputNames, stepInputOutputName)];
    },

    describe(option) {
      return `Select parent element: Traverse until (${normalizeUntilSelector(option.untilSelector)})`;
    },
  },

  "traverse-n-times": {
    isObserverBoundary: false,

    buildFunctionCode(_step, option, { functionName, inputNames }) {
      const count = normalizeTraversalCount(option.count);
      const nextElementName = toNextSelectedElementName();
      const selectedElementInput = inputNames.includes(stepInputOutputName) ? stepInputOutputName : "null";
      const extras = getPassthroughExtras(inputNames, stepInputOutputName);
      return {
        functionName,
        inputNames,
        code: buildStepFunctionCode({
          functionName,
          inputNames,
          bodyLines: [
            `let ${nextElementName} = ${selectedElementInput}`,
            `const parentCount = ${count}`,
            "for (let i = 0; i < parentCount; i += 1) {",
            `  if (!${nextElementName} || !${nextElementName}.parentElement) {`,
            `    ${nextElementName} = null`,
            "    break",
            "  }",
            `  ${nextElementName} = ${nextElementName}.parentElement`,
            "}",
          ],
          outputs: [
            { name: stepInputOutputName, expression: nextElementName },
            ...extras.map((name) => ({ name, expression: name })),
          ],
        }),
        outputNames: [stepInputOutputName, ...extras],
      };
    },

    buildCombinedLines(_step, option, { stepNumber, state }) {
      const count = normalizeTraversalCount(option.count);
      return {
        lines: [
          `let nextSelectedElement${stepNumber} = ${stepInputOutputName}`,
          `const parentCount${stepNumber} = ${count}`,
          `for (let i = 0; i < parentCount${stepNumber}; i += 1) {`,
          `  if (!nextSelectedElement${stepNumber} || !nextSelectedElement${stepNumber}.parentElement) {`,
          `    nextSelectedElement${stepNumber} = null`,
          "    break",
          "  }",
          `  nextSelectedElement${stepNumber} = nextSelectedElement${stepNumber}.parentElement`,
          "}",
          `${stepInputOutputName} = nextSelectedElement${stepNumber}`,
        ],
        state,
      };
    },

    getOutputNames(inputNames) {
      return [stepInputOutputName, ...getPassthroughExtras(inputNames, stepInputOutputName)];
    },

    describe(option) {
      return `Select parent element: Traverse n times (${normalizeTraversalCount(option.count)})`;
    },
  },

  "selector-reselect": {
    isObserverBoundary: true,

    buildFunctionCode(_step, option, { functionName, inputNames, stepNumber }) {
      const selectorValue = normalizeUntilSelector(option.untilSelector);
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

    buildCombinedLines(_step, _option, { state }) {
      return { lines: [], state };
    },

    buildCombinedObserverLines(_step, option, { stepNumber, callbackLines }) {
      return [
        ...buildSelectorLines({
          selectorName: `selector${stepNumber}`,
          selectorValue: normalizeUntilSelector(option.untilSelector),
          selectorLabel: `Selector ${stepNumber}`,
        }),
        `selector${stepNumber}.onElementMatches(async (${stepInputOutputName}) => {`,
        ...indentLines(callbackLines),
        "})",
      ];
    },

    getOutputNames(inputNames) {
      return [stepInputOutputName, ...getPassthroughExtras(inputNames, stepInputOutputName)];
    },

    describe(option) {
      return `Select parent element: Selector re-select (${normalizeUntilSelector(option.untilSelector)})`;
    },
  },
};

export class SelectParentStep implements StepGenerator {
  private readonly impl: ParentModeImpl;

  constructor(
    private step: SupportedRecordStep,
    private option: ParentTraversalOption,
  ) {
    this.impl = modeImpls[option.mode];
  }

  buildFunctionCode(ctx: FunctionCodeContext): BuiltStepCode {
    return this.impl.buildFunctionCode(this.step, this.option, ctx);
  }

  buildCombinedLines(ctx: CombinedLinesContext): CombinedLinesResult {
    return this.impl.buildCombinedLines(this.step, this.option, ctx);
  }

  buildCombinedObserverLines(ctx: CombinedObserverContext): string[] {
    return this.impl.buildCombinedObserverLines!(this.step, this.option, ctx);
  }

  getOutputNames(inputNames: string[]): string[] {
    return this.impl.getOutputNames(inputNames);
  }

  isObserverBoundary(): boolean {
    return this.impl.isObserverBoundary;
  }

  describe(): string {
    return this.impl.describe(this.option);
  }
}
