import type { SupportedRecordStep } from "../../normalize";
import type { ModeImpl, ParentTraversalMode, ParentTraversalOption } from "../types";
import { ModeBasedStep } from "../types";
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

const modeImpls: Record<ParentTraversalMode, (option: ParentTraversalOption) => ModeImpl> = {
  "traverse-until": (option) => ({
    isObserverBoundary: false,

    buildFunctionCode(_step, { functionName, inputNames }) {
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

    buildCombinedLines(_step, { stepNumber, state }) {
      const untilSelector = normalizeUntilSelector(option.untilSelector);
      return {
        lines: [
          ...buildSelectorLines({
            selectorName: `traverseUntilSelector${stepNumber}`,
            selectorValue: untilSelector,
          }),
          `const nextSelectedElement${stepNumber} = ${stepInputOutputName}`,
          `  ? pq.traverseParents(${stepInputOutputName}, e => traverseUntilSelector${stepNumber}.matches(e))`,
          "  : null",
          `${stepInputOutputName} = nextSelectedElement${stepNumber}`,
        ],
        state,
      };
    },

    getOutputNames(_step, inputNames) {
      return [stepInputOutputName, ...getPassthroughExtras(inputNames, stepInputOutputName)];
    },

    describe() {
      return `Select parent element: Traverse until (${normalizeUntilSelector(option.untilSelector)})`;
    },
  }),

  "traverse-n-times": (option) => ({
    isObserverBoundary: false,

    buildFunctionCode(_step, { functionName, inputNames }) {
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

    buildCombinedLines(_step, { stepNumber, state }) {
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

    getOutputNames(_step, inputNames) {
      return [stepInputOutputName, ...getPassthroughExtras(inputNames, stepInputOutputName)];
    },

    describe() {
      return `Select parent element: Traverse n times (${normalizeTraversalCount(option.count)})`;
    },
  }),

  "selector-reselect": (option) => ({
    isObserverBoundary: true,

    buildFunctionCode(_step, { functionName, inputNames, stepNumber }) {
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
            ...buildSelectorLines({ selectorName: "selector", selectorValue }),
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

    buildCombinedObserverLines(_step, { stepNumber, callbackLines }) {
      return [
        ...buildSelectorLines({
          selectorName: `selector${stepNumber}`,
          selectorValue: normalizeUntilSelector(option.untilSelector),
        }),
        `selector${stepNumber}.onElementMatches((${stepInputOutputName}) => {`,
        ...indentLines(callbackLines),
        "})",
      ];
    },

    getOutputNames(_step, inputNames) {
      return [stepInputOutputName, ...getPassthroughExtras(inputNames, stepInputOutputName)];
    },

    describe() {
      return `Select parent element: Selector re-select (${normalizeUntilSelector(option.untilSelector)})`;
    },
  }),
};

export class SelectParentStep extends ModeBasedStep {
  constructor(step: SupportedRecordStep, option: ParentTraversalOption) {
    super(step, modeImpls[option.mode](option));
  }
}
