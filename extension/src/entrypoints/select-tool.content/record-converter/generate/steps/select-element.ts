import type { SupportedRecordStep } from "../../normalize";
import type { ModeImpl, SelectElementMode, SelectElementOption } from "../types";
import { ModeBasedStep } from "../types";
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

    buildFunctionCode(step, { functionName, inputNames }) {
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
          bodyLines: [...buildSelectorLines({ selectorName: "selector", selectorValue }), assignmentLine],
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
    resetTopLevel: true,
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

    buildCombinedObserverLines(step, { stepNumber, callbackLines }) {
      return [
        ...buildSelectorLines({
          selectorName: `selector${stepNumber}`,
          selectorValue: resolveSelectElementSelector(step),
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

export class SelectElementStep extends ModeBasedStep {
  constructor(step: SupportedRecordStep, option: SelectElementOption) {
    super(step, modeImpls[option.mode]);
  }
}
