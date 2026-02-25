import { resolveRecordConverterCollisions } from "./collision";
import type { SupportedRecordStep } from "./normalize";

export type ParentTraversalMode = "traverse-until" | "traverse-n-times";

export type ParentTraversalOption = {
  mode: ParentTraversalMode;
  untilSelector: string;
  count: number;
};

export type ParentTraversalOptionsByStepId = Record<string, ParentTraversalOption>;

export type GeneratedReviewCode = {
  rawCode: string;
  finalCode: string;
  renameMap: Record<string, string>;
};

const selectedElementSelectorFallback = "auto-generated selector for the element";

const buildTemplateBlock = ({
  inputs,
  codeLines,
  outputs,
  configuredOptions,
}: {
  inputs: string;
  codeLines: string[];
  outputs: string;
  configuredOptions: string[];
}) => {
  return [
    `// inputs: ${inputs}`,
    ...codeLines,
    `// outputs: ${outputs}`,
    "",
    "current configured options for the selected step:",
    ...configuredOptions,
  ].join("\n");
};

const toStringLiteral = (value: string) => JSON.stringify(value);

const resolveSelectElementSelector = (step: SupportedRecordStep) => {
  return step.selectorHint && step.selectorHint.trim().length > 0
    ? step.selectorHint.trim()
    : selectedElementSelectorFallback;
};

const buildPreviewSelectElementCode = (step: SupportedRecordStep) => {
  const selectorValue = resolveSelectElementSelector(step);
  return [
    "const selector = pq.selector({",
    `    name: ${toStringLiteral("Selector 1")},`,
    `    baseSelector: ${toStringLiteral(selectorValue)},`,
    "    matches: e => true",
    "})",
  ];
};

const buildPreviewTraverseUntilCode = (option: ParentTraversalOption) => {
  const untilSelector = option.untilSelector.trim().length > 0 ? option.untilSelector.trim() : "auto generated selector";
  return [
    "const selectedElement = await selector.waitUntilMatch()",
    "const traverseUntilSelector = pq.selector({",
    `    name: ${toStringLiteral("Traverse until selector 1")},`,
    `    baseSelector: ${toStringLiteral(untilSelector)},`,
    "    matches: e => true",
    "})",
    "const selectedElement2 = pq.traverseParents(selectedElement, e => traverseUntilSelector.matches(e))",
  ];
};

const buildPreviewTraverseCountCode = (option: ParentTraversalOption) => {
  const count = Number.isFinite(option.count) && option.count > 0 ? Math.floor(option.count) : 1;
  return [
    "const selectedElement = await selector.waitUntilMatch()",
    `const n = ${count}`,
    "for (let i = 0; i < n; i++)",
    "    selectedElement = selectedElement.parentElement",
  ];
};

const toSuffixedName = (base: string, index: number) => (index <= 1 ? base : `${base}${index}`);

const buildReviewSelectElementCode = ({
  selectorName,
  selectorValue,
}: {
  selectorName: string;
  selectorValue: string;
}) => {
  return [
    `const ${selectorName} = pq.selector({`,
    `    name: ${toStringLiteral("Selector 1")},`,
    `    baseSelector: ${toStringLiteral(selectorValue)},`,
    "    matches: e => true",
    "})",
  ];
};

const buildReviewTraverseUntilCode = ({
  selectorName,
  selectedElementName,
  traverseUntilSelectorName,
  outputElementName,
  untilSelector,
}: {
  selectorName: string;
  selectedElementName: string;
  traverseUntilSelectorName: string;
  outputElementName: string;
  untilSelector: string;
}) => {
  return [
    `const ${selectedElementName} = await ${selectorName}.waitUntilMatch()`,
    `const ${traverseUntilSelectorName} = pq.selector({`,
    `    name: ${toStringLiteral("Traverse until selector 1")},`,
    `    baseSelector: ${toStringLiteral(untilSelector)},`,
    "    matches: e => true",
    "})",
    `const ${outputElementName} = pq.traverseParents(${selectedElementName}, e => ${traverseUntilSelectorName}.matches(e))`,
  ];
};

const buildReviewTraverseCountCode = ({
  selectorName,
  selectedElementName,
  nName,
  count,
}: {
  selectorName: string;
  selectedElementName: string;
  nName: string;
  count: number;
}) => {
  return [
    `let ${selectedElementName} = await ${selectorName}.waitUntilMatch()`,
    `const ${nName} = ${count}`,
    `for (let i = 0; i < ${nName}; i++)`,
    `    ${selectedElementName} = ${selectedElementName}.parentElement`,
  ];
};

export const buildDefaultParentTraversalOption = (count: number): ParentTraversalOption => ({
  mode: "traverse-n-times",
  untilSelector: "auto generated selector",
  count: Math.max(1, Math.floor(count)),
});

export const buildStepSnippet = (step: SupportedRecordStep, parentOptions: ParentTraversalOptionsByStepId) => {
  if (step.kind === "select-element") {
    return buildTemplateBlock({
      inputs: "variableName1, variableName2, methodName1",
      codeLines: buildPreviewSelectElementCode(step),
      outputs: "outputVar1, outputVar2, outputMethod1",
      configuredOptions: ["select element"],
    });
  }

  const option = parentOptions[step.id] ?? buildDefaultParentTraversalOption(step.count);
  const codeLines =
    option.mode === "traverse-until" ? buildPreviewTraverseUntilCode(option) : buildPreviewTraverseCountCode(option);

  return buildTemplateBlock({
    inputs: "variableName1, variableName2, methodName1",
    codeLines,
    outputs: "outputVar1, outputVar2, outputMethod1",
    configuredOptions: [
      option.mode === "traverse-until"
        ? `select parent element: traverse until (${option.untilSelector || "auto generated selector"})`
        : `select parent element: traverse n times (${Math.max(1, Math.floor(option.count))})`,
    ],
  });
};

const buildReviewStepSnippet = ({
  step,
  parentOption,
  selectorSequence,
  parentSequence,
  selectorName,
}: {
  step: SupportedRecordStep;
  parentOption: ParentTraversalOption | null;
  selectorSequence: number;
  parentSequence: number;
  selectorName: string;
}) => {
  if (step.kind === "select-element") {
    return buildTemplateBlock({
      inputs: "variableName1, variableName2, methodName1",
      codeLines: buildReviewSelectElementCode({
        selectorName,
        selectorValue: resolveSelectElementSelector(step),
      }),
      outputs: "outputVar1, outputVar2, outputMethod1",
      configuredOptions: [`select element (${selectorName})`],
    });
  }

  const option = parentOption ?? buildDefaultParentTraversalOption(step.count);
  const selectedElementName = toSuffixedName("selectedElement", Math.max(1, parentSequence * 2 - 1));
  const outputElementName = `selectedElement${parentSequence * 2}`;
  const nName = toSuffixedName("n", parentSequence);
  const traverseUntilSelectorName = toSuffixedName("traverseUntilSelector", parentSequence);
  const sanitizedCount = Math.max(1, Math.floor(option.count));
  const untilSelector = option.untilSelector.trim().length > 0 ? option.untilSelector.trim() : "auto generated selector";
  const codeLines =
    option.mode === "traverse-until"
      ? buildReviewTraverseUntilCode({
          selectorName,
          selectedElementName,
          traverseUntilSelectorName,
          outputElementName,
          untilSelector,
        })
      : buildReviewTraverseCountCode({
          selectorName,
          selectedElementName,
          nName,
          count: sanitizedCount,
        });

  return buildTemplateBlock({
    inputs: "variableName1, variableName2, methodName1",
    codeLines,
    outputs: "outputVar1, outputVar2, outputMethod1",
    configuredOptions: [
      option.mode === "traverse-until"
        ? `select parent element: traverse until (${untilSelector})`
        : `select parent element: traverse n times (${sanitizedCount})`,
      `selector reference: ${selectorName}`,
      `selector sequence: ${selectorSequence}`,
    ],
  });
};

export const buildGeneratedReviewCode = ({
  steps,
  parentOptions,
  existingCode,
}: {
  steps: SupportedRecordStep[];
  parentOptions: ParentTraversalOptionsByStepId;
  existingCode: string;
}): GeneratedReviewCode => {
  let selectorSequence = 0;
  let parentSequence = 0;
  let activeSelectorName = "selector";

  const rawCode = steps
    .map((step) => {
      if (step.kind === "select-element") {
        selectorSequence += 1;
        activeSelectorName = toSuffixedName("selector", selectorSequence);
        return buildReviewStepSnippet({
          step,
          parentOption: null,
          selectorSequence,
          parentSequence,
          selectorName: activeSelectorName,
        });
      }

      parentSequence += 1;
      return buildReviewStepSnippet({
        step,
        parentOption: parentOptions[step.id] ?? buildDefaultParentTraversalOption(step.count),
        selectorSequence,
        parentSequence,
        selectorName: activeSelectorName,
      });
    })
    .join("\n\n");

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
