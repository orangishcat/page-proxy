import { describe, expect, test } from "bun:test";

import { buildReviewCodeFromStepPreviews } from "../src/entrypoints/select-tool.content/record-converter/review-code";
import { normalizeRecordTimeline } from "../src/entrypoints/select-tool.content/record-converter/normalize";

const buildTimeline = (entries: Array<{ action: string; detail?: string }>) =>
  entries.map((entry, index) => ({
    id: `step-${index + 1}`,
    action: entry.action,
    detail: entry.detail ?? "",
    timestamp: index + 1,
  }));

describe("buildReviewCodeFromStepPreviews", () => {
  test("uses edited step snippets in functions review mode", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: .original" },
        { action: "Clicked element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      stepCodeByStepId: {
        "step-1": [
          "async function step1() {",
          "  const selector = pq.selector({",
          '    name: "Selector 1",',
          '    baseSelector: ".edited",',
          "    matches: e => e instanceof HTMLButtonElement",
          "  })",
          "  const selectedElement = await selector.waitUntilMatch()",
          "  return [selectedElement]",
          "}",
        ].join("\n"),
        "step-2": [
          "async function step2(selectedElement) {",
          "  if (selectedElement) {",
          "    selectedElement.dataset.clicked = \"true\"",
          "  }",
          "  return [selectedElement]",
          "}",
        ].join("\n"),
      },
      selectOptions: {
        "step-1": {
          mode: "wait-until-match",
        },
      },
      existingCode: "",
    });

    expect(generated.byMode.functions.rawCode).toContain('baseSelector: ".edited"');
    expect(generated.byMode.functions.rawCode).toContain('selectedElement.dataset.clicked = "true"');
    expect(generated.byMode.functions.rawCode).toContain("const step2Result = await step2(...step1Result)");
  });

  test("uses edited step snippets in combined review mode", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: .original" },
        { action: "Copied element" },
        { action: "Selected element", detail: "selector: .target" },
        { action: "Pasted element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      stepCodeByStepId: {
        "step-2": [
          "async function step2(selectedElement) {",
          "  const clipboardHtml = selectedElement ? selectedElement.innerHTML : null",
          "  return [selectedElement, clipboardHtml]",
          "}",
        ].join("\n"),
        "step-4": [
          "async function step4(selectedElement, clipboardHtml) {",
          "  if (selectedElement && clipboardHtml) {",
          '    selectedElement.insertAdjacentHTML("beforeend", clipboardHtml)',
          "  }",
          "  return [selectedElement, clipboardHtml]",
          "}",
        ].join("\n"),
      },
      existingCode: "",
    });

    expect(generated.byMode.combined.rawCode).toContain("let clipboardHtml = null");
    expect(generated.byMode.combined.rawCode).toContain("selectedElement ? selectedElement.innerHTML : null");
    expect(generated.byMode.combined.rawCode).toContain('selectedElement.insertAdjacentHTML("beforeend", clipboardHtml)');
    expect(generated.byMode.combined.rawCode).not.toContain("return [selectedElement, clipboardHtml]");
  });

  test("combined review mode does not inject a top-level selectedElement seed", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: .original" },
        { action: "Clicked element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      selectOptions: {
        "step-1": {
          mode: "wait-until-match",
        },
      },
      existingCode: "",
    });

    expect(generated.byMode.combined.rawCode).not.toContain("let selectedElement = null");
    expect(generated.byMode.combined.rawCode).toContain("let selectedElement = await selector.waitUntilMatch()");
    expect(generated.byMode.combined.rawCode).not.toContain("\n\n");
  });

  test("combined review mode wraps edited later steps inside onElementMatches when configured", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: .original" },
        { action: "Copied element" },
        { action: "Selected element", detail: "selector: .target" },
        { action: "Pasted element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      stepCodeByStepId: {
        "step-2": [
          "async function step2(selectedElement) {",
          "  const clipboardHtml = selectedElement ? selectedElement.innerHTML : null",
          "  return [selectedElement, clipboardHtml]",
          "}",
        ].join("\n"),
        "step-4": [
          "async function step4(selectedElement, clipboardHtml) {",
          "  if (selectedElement && clipboardHtml) {",
          '    selectedElement.insertAdjacentHTML("beforeend", clipboardHtml)',
          "  }",
          "  return [selectedElement, clipboardHtml]",
          "}",
        ].join("\n"),
      },
      selectOptions: {
        "step-1": {
          mode: "on-element-matches",
        },
      },
      existingCode: "",
    });

    expect(generated.byMode.combined.rawCode).toContain("selector.onElementMatches((selectedElement) => {");
    expect(generated.byMode.combined.rawCode).not.toContain("let selectedElement = matchedElement");
    expect(generated.byMode.combined.rawCode).toContain("selectedElement ? selectedElement.innerHTML : null");
    expect(generated.byMode.combined.rawCode).toContain('selectedElement.insertAdjacentHTML("beforeend", clipboardHtml)');
  });

  test("combined review mode defaults select steps to onElementMatches", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: .original" },
        { action: "Clicked element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      existingCode: "",
    });

    expect(generated.byMode.combined.rawCode).toContain("selector.onElementMatches((selectedElement) => {");
    expect(generated.byMode.combined.rawCode).not.toContain("await selector.waitUntilMatch()");
  });

  test("combined review mode collapses blank lines from edited step snippets", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: .original" },
        { action: "Clicked element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      stepCodeByStepId: {
        "step-1": [
          "async function step1() {",
          "",
          "  const selector = pq.selector({",
          "",
          '    name: "Selector 1",',
          "",
          '    baseSelector: ".original",',
          "",
          "    matches: e => true",
          "",
          "  })",
          "",
          "  let selectedElement = await selector.waitUntilMatch()",
          "",
          "  return [selectedElement]",
          "}",
        ].join("\n"),
      },
      existingCode: "",
    });

    expect(generated.byMode.combined.rawCode).not.toContain("\n\n");
  });

  test("combined review mode reassigns selectedElement from parent traversal outputs", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: .child" },
        { action: "Selected parent element", detail: "selector: .parent" },
        { action: "Deleted element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      existingCode: "",
    });

    expect(generated.byMode.combined.rawCode).toContain("const nextSelectedElement = selectedElement");
    expect(generated.byMode.combined.rawCode).toContain("selectedElement = nextSelectedElement");
    expect(generated.byMode.combined.rawCode).toContain("selectedElement.remove()");
  });

  test("combined review mode lifts later select chains out of earlier onElementMatches blocks", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: path" },
        { action: "Deleted element" },
        { action: "Selected element", detail: "selector: div.target" },
        { action: "Deleted element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      existingCode: "",
    });

    expect(generated.byMode.combined.rawCode).toContain("selector.onElementMatches((selectedElement) => {");
    expect(generated.byMode.combined.rawCode).not.toContain(
      [
        "selector.onElementMatches((selectedElement) => {",
        "  selectedElement.remove()",
        "  const selector = pq.selector({",
      ].join("\n"),
    );
    expect(generated.byMode.combined.rawCode).toContain("const selector2 = pq.selector({");
    expect(generated.byMode.combined.rawCode).toContain("selector2.onElementMatches((selectedElement) => {");
    expect(generated.byMode.combined.finalCode).toContain("const selector2 = pq.selector({");
    expect(generated.byMode.combined.finalCode).toContain("selector2.onElementMatches((selectedElement) => {");
    expect(generated.byMode.combined.renameMap).toEqual({ selector: "selector2" });
  });

  test("combined review mode renames top-level selector collisions for edited multi-step chains", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: a.encore-text-body-small-bold" },
        { action: "Deleted element" },
        { action: "Selected element", detail: "selector: span.e-10180-legacy-button--small" },
        { action: "Selected parent element", detail: "selector: button.encore-text-body-small-bold.e-10180-legacy-button-primary" },
        { action: "Deleted element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      stepCodeByStepId: {
        "step-1": [
          "async function step1() {",
          "  const selector = pq.selector({",
          '    baseSelector: "a.encore-text-body-small-bold",',
          "    matches: e => true",
          "  })",
          "  selector.onElementMatches((selectedElement) => {",
          "    void runAfterStep1(selectedElement)",
          "  })",
          "  return []",
          "}",
        ].join("\n"),
        "step-2": [
          "async function step2(selectedElement) {",
          "  selectedElement.remove()",
          "  return []",
          "}",
        ].join("\n"),
        "step-3": [
          "async function step3(selectedElement) {",
          "  const selector = pq.selector({",
          '    baseSelector: "span.e-10180-legacy-button--small",',
          "    matches: e => true",
          "  })",
          "  selector.onElementMatches((selectedElement) => {",
          "    void runAfterStep3(selectedElement)",
          "  })",
          "  return []",
          "}",
        ].join("\n"),
        "step-4": [
          "async function step4(selectedElement) {",
          "  const traverseUntilSelector = pq.selector({",
          '    baseSelector: "button.encore-text-body-small-bold.e-10180-legacy-button-primary",',
          "    matches: e => true",
          "  })",
          "  const nextSelectedElement = selectedElement",
          "    ? pq.traverseParents(selectedElement, e => traverseUntilSelector.matches(e))",
          "    : null",
          "  return [nextSelectedElement]",
          "}",
        ].join("\n"),
        "step-5": [
          "async function step5(selectedElement) {",
          "  selectedElement.remove()",
          "  return []",
          "}",
        ].join("\n"),
      },
      existingCode: "",
    });

    expect(generated.byMode.combined.rawCode).toContain('baseSelector: "a.encore-text-body-small-bold"');
    expect(generated.byMode.combined.rawCode).toContain("const selector2 = pq.selector({");
    expect(generated.byMode.combined.rawCode).toContain('baseSelector: "span.e-10180-legacy-button--small"');
    expect(generated.byMode.combined.rawCode).toContain("selector2.onElementMatches((selectedElement) => {");
    expect(generated.byMode.combined.rawCode).not.toContain("\nconst selector = pq.selector({\n  baseSelector: \"span.e-10180-legacy-button--small\"");
  });
});
