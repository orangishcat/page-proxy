import { resolveRecordConverterCollisions } from "./collision";
import {
  buildStepSnippet,
  type GeneratedReviewCode,
  type ParentTraversalOptionsByStepId,
  type ReviewCodeMode,
} from "./generate";
import type { SupportedRecordStep } from "./normalize";

const selectedElementName = "selectedElement";
const clipboardHtmlName = "clipboardHtml";

const parseStepNumber = (stepId: string) => {
  const parsed = Number.parseInt(stepId.replace("step-", ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const buildStepFunctionName = (step: SupportedRecordStep) => `step${parseStepNumber(step.id)}`;

const readStepCode = ({
  step,
  stepCodeByStepId,
  parentOptions,
  defaultParentUntilSelector,
}: {
  step: SupportedRecordStep;
  stepCodeByStepId: Record<string, string>;
  parentOptions: ParentTraversalOptionsByStepId;
  defaultParentUntilSelector: string;
}) =>
  stepCodeByStepId[step.id] ??
  buildStepSnippet(step, parentOptions, defaultParentUntilSelector);

const extractFunctionName = (step: SupportedRecordStep, stepCode: string) => {
  const match = stepCode.match(/async function\s+([A-Za-z_$][\w$]*)\s*\(/);
  return match?.[1] ?? buildStepFunctionName(step);
};

const trimEmptyEdges = (lines: string[]) => {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim().length === 0) {
    start += 1;
  }
  while (end > start && lines[end - 1].trim().length === 0) {
    end -= 1;
  }

  return lines.slice(start, end);
};

const dedentBodyLines = (lines: string[]) =>
  lines.map((line) => (line.startsWith("  ") ? line.slice(2) : line));

const stripFinalReturnLine = (lines: string[]) => {
  const nextLines = [...lines];
  for (let index = nextLines.length - 1; index >= 0; index -= 1) {
    const trimmed = nextLines[index].trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (trimmed.startsWith("return ")) {
      nextLines.splice(index, 1);
    }
    break;
  }
  return nextLines;
};

const extractCombinedBodyLines = (stepCode: string) => {
  const lines = stepCode.replace(/\r\n/g, "\n").split("\n");
  const openingLineIndex = lines.findIndex((line) => line.includes("{"));
  const closingLineIndex = lines.length - 1 - [...lines].reverse().findIndex((line) => line.trim() === "}");

  if (openingLineIndex === -1 || closingLineIndex <= openingLineIndex) {
    return trimEmptyEdges(lines);
  }

  const bodyLines = lines.slice(openingLineIndex + 1, closingLineIndex);
  return trimEmptyEdges(stripFinalReturnLine(dedentBodyLines(bodyLines)));
};

const resolveGeneratedCode = (rawCode: string, existingCode: string) => {
  const resolved = resolveRecordConverterCollisions({
    code: rawCode,
    existingCode,
  });

  return {
    rawCode,
    finalCode: resolved.finalCode,
    renameMap: resolved.renameMap,
  };
};

const buildFunctionsRawCodeFromStepPreviews = ({
  steps,
  stepCodeByStepId,
  parentOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  stepCodeByStepId: Record<string, string>;
  parentOptions: ParentTraversalOptionsByStepId;
  defaultParentUntilSelector: string;
}) => {
  if (steps.length === 0) {
    return "";
  }

  const stepCodes = steps.map((step) =>
    readStepCode({
      step,
      stepCodeByStepId,
      parentOptions,
      defaultParentUntilSelector,
    }),
  );
  const functionDefinitions = stepCodes.join("\n\n");

  let previousResultName = "";
  const invocationLines = steps.map((step, index) => {
    const functionName = extractFunctionName(step, stepCodes[index]);
    const resultName = `${functionName}Result`;
    const invocationLine =
      index === 0
        ? `const ${resultName} = await ${functionName}()`
        : `const ${resultName} = await ${functionName}(...${previousResultName})`;
    previousResultName = resultName;
    return invocationLine;
  });

  return [functionDefinitions, invocationLines.join("\n")].filter((section) => section.trim().length > 0).join("\n\n");
};

const buildCombinedRawCodeFromStepPreviews = ({
  steps,
  stepCodeByStepId,
  parentOptions,
  defaultParentUntilSelector,
}: {
  steps: SupportedRecordStep[];
  stepCodeByStepId: Record<string, string>;
  parentOptions: ParentTraversalOptionsByStepId;
  defaultParentUntilSelector: string;
}) => {
  if (steps.length === 0) {
    return "";
  }

  const stepCodes = steps.map((step) =>
    readStepCode({
      step,
      stepCodeByStepId,
      parentOptions,
      defaultParentUntilSelector,
    }),
  );
  const lines = [`let ${selectedElementName} = null`];

  if (stepCodes.some((stepCode) => stepCode.includes(clipboardHtmlName))) {
    lines.push(`let ${clipboardHtmlName} = null`);
  }

  stepCodes.forEach((stepCode) => {
    const bodyLines = extractCombinedBodyLines(stepCode);
    if (bodyLines.length === 0) {
      return;
    }
    lines.push("");
    lines.push(...bodyLines);
  });

  return lines.join("\n");
};

export const buildReviewCodeFromStepPreviews = ({
  steps,
  stepCodeByStepId = {},
  parentOptions = {},
  existingCode,
  defaultParentUntilSelector = "body",
}: {
  steps: SupportedRecordStep[];
  stepCodeByStepId?: Record<string, string>;
  parentOptions?: ParentTraversalOptionsByStepId;
  existingCode: string;
  defaultParentUntilSelector?: string;
}): GeneratedReviewCode => {
  const byMode: Record<ReviewCodeMode, GeneratedReviewCode["byMode"][ReviewCodeMode]> = {
    combined: resolveGeneratedCode(
      buildCombinedRawCodeFromStepPreviews({
        steps,
        stepCodeByStepId,
        parentOptions,
        defaultParentUntilSelector,
      }),
      existingCode,
    ),
    functions: resolveGeneratedCode(
      buildFunctionsRawCodeFromStepPreviews({
        steps,
        stepCodeByStepId,
        parentOptions,
        defaultParentUntilSelector,
      }),
      existingCode,
    ),
  };
  const defaultMode = byMode.combined;

  return {
    rawCode: defaultMode.rawCode,
    finalCode: defaultMode.finalCode,
    renameMap: defaultMode.renameMap,
    byMode,
  };
};
