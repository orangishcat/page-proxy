import { describe, expect, test } from "bun:test";

import {
  buildGeneratedReviewCode,
  type ParentTraversalOptionsByStepId,
  type SelectElementOptionsByStepId,
} from "../src/entrypoints/select-tool.content/record-converter/generate";
import { normalizeRecordTimeline } from "../src/entrypoints/select-tool.content/record-converter/normalize";

describe("record converter click support", () => {
  test("normalizeRecordTimeline supports click action labels", () => {
    const normalized = normalizeRecordTimeline([
      { id: "entry-1", action: "Selected element", detail: "selector: button", timestamp: 1 },
      { id: "entry-2", action: "click", detail: "", timestamp: 2 },
      { id: "entry-3", action: "Clicked element", detail: "", timestamp: 3 },
    ]);

    expect(normalized.supportedSteps).toHaveLength(3);
    expect(normalized.supportedSteps.map((step) => step.kind)).toEqual([
      "select-element",
      "click-element",
      "click-element",
    ]);
    expect(normalized.supportedSteps.map((step) => step.label)).toEqual([
      "Selected element",
      "Click element",
      "Click element",
    ]);
  });

  test("buildGeneratedReviewCode emits click() for click-element steps", () => {
    const normalized = normalizeRecordTimeline([
      { id: "entry-1", action: "Selected element", detail: "selector: button", timestamp: 1 },
      { id: "entry-2", action: "click", detail: "", timestamp: 2 },
    ]);

    const generated = buildGeneratedReviewCode({
      steps: normalized.supportedSteps,
      parentOptions: {},
      existingCode: "",
      defaultParentUntilSelector: "body",
    });

    expect(generated.byMode.combined.rawCode).toContain("selectedElement.click()");
    expect(generated.byMode.functions.rawCode).toContain("selectedElement.click()");
    expect(generated.byMode.functions.rawCode).toContain("return [selectedElement]");
  });

  test("generated click code does not wrap selectedElement in a null check", () => {
    const normalized = normalizeRecordTimeline([
      { id: "entry-1", action: "Selected element", detail: "selector: button", timestamp: 1 },
      { id: "entry-2", action: "click", detail: "", timestamp: 2 },
    ]);

    const generated = buildGeneratedReviewCode({
      steps: normalized.supportedSteps,
      parentOptions: {},
      existingCode: "",
      defaultParentUntilSelector: "body",
    });

    expect(generated.byMode.combined.rawCode).not.toContain("if (selectedElement)");
    expect(generated.byMode.functions.rawCode).not.toContain("if (selectedElement)");
  });
});

describe("record converter: new step kinds — normalize", () => {
  test("normalizeRecordTimeline maps cut/copy/paste/hide/apply-style actions", () => {
    const normalized = normalizeRecordTimeline([
      { id: "e1", action: "Selected element", detail: "selector: .foo", timestamp: 1 },
      { id: "e2", action: "Cut element", detail: "selector: .foo", timestamp: 2 },
      { id: "e3", action: "Selected element", detail: "selector: .bar", timestamp: 3 },
      { id: "e4", action: "Pasted element", detail: "", timestamp: 4 },
      { id: "e5", action: "Selected element", detail: "selector: .baz", timestamp: 5 },
      { id: "e6", action: "Hide element", detail: "selector: .baz", timestamp: 6 },
      { id: "e7", action: "Copied element", detail: "", timestamp: 7 },
      { id: "e8", action: "Applied style", detail: JSON.stringify({ color: "red" }), timestamp: 8 },
    ]);

    expect(normalized.supportedSteps.map((s) => s.kind)).toEqual([
      "select-element",
      "cut-element",
      "select-element",
      "paste-element",
      "select-element",
      "hide-element",
      "copy-element",
      "apply-style-element",
    ]);
  });

  test("hide step records display none cssValues", () => {
    const normalized = normalizeRecordTimeline([
      { id: "e1", action: "Selected element", detail: "selector: .foo", timestamp: 1 },
      { id: "e2", action: "Hide element", detail: "selector: .foo", timestamp: 2 },
    ]);

    expect(normalized.supportedSteps[1].kind).toBe("hide-element");
    expect(normalized.supportedSteps[1].label).toBe("Hide element");
    expect(normalized.supportedSteps[1].cssValues).toEqual({ display: "none" });
  });

  test("apply-style step parses cssValues from detail", () => {
    const cssValues = { color: "red", "font-size": "14px" };
    const normalized = normalizeRecordTimeline([
      { id: "e1", action: "Selected element", detail: "selector: .foo", timestamp: 1 },
      { id: "e2", action: "Applied style", detail: JSON.stringify(cssValues), timestamp: 2 },
    ]);

    expect(normalized.supportedSteps[1].cssValues).toEqual(cssValues);
  });

  test("unsupported action becomes skipped entry", () => {
    const normalized = normalizeRecordTimeline([
      { id: "e1", action: "Selected element", detail: "selector: .foo", timestamp: 1 },
      { id: "e2", action: "Unknown thing happened", detail: "", timestamp: 2 },
    ]);
    expect(normalized.supportedSteps).toHaveLength(1);
    expect(normalized.skippedEntries).toHaveLength(1);
  });
});

describe("record converter: new step kinds — generate", () => {
  const makeTimeline = (entries: { action: string; detail?: string }[]) =>
    entries.map((e, i) => ({ id: `e${i + 1}`, action: e.action, detail: e.detail ?? "", timestamp: i + 1 }));

  const generate = ({
    entries,
    parentOptions = {},
    selectOptions = {},
  }: {
    entries: { action: string; detail?: string }[];
    parentOptions?: ParentTraversalOptionsByStepId;
    selectOptions?: SelectElementOptionsByStepId;
  }) => {
    const { supportedSteps } = normalizeRecordTimeline(makeTimeline(entries));
    return buildGeneratedReviewCode({
      steps: supportedSteps,
      parentOptions,
      selectOptions,
      existingCode: "",
      defaultParentUntilSelector: "body",
    });
  };

  test("cut: combined mode removes element and nulls selectedElement", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Cut element" }],
    });
    expect(code.byMode.combined.rawCode).toContain("clipboardHtml");
    expect(code.byMode.combined.rawCode).toContain(".remove()");
    expect(code.byMode.combined.rawCode).toContain("selectedElement = null");
    expect(code.byMode.combined.rawCode).not.toContain("selectedElement ? selectedElement.outerHTML : null");
    expect(code.byMode.combined.rawCode).not.toContain("if (selectedElement)");
  });

  test("cut: functions mode returns [null, clipboardHtml]", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Cut element" }],
    });
    expect(code.byMode.functions.rawCode).toContain("clipboardHtml");
    expect(code.byMode.functions.rawCode).toContain(".remove()");
    expect(code.byMode.functions.rawCode).toContain("return [null, clipboardHtml]");
    expect(code.byMode.functions.rawCode).not.toContain("selectedElement ? selectedElement.outerHTML : null");
    expect(code.byMode.functions.rawCode).not.toContain("if (selectedElement)");
  });

  test("copy: combined mode captures outerHTML", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Copied element" }],
    });
    expect(code.byMode.combined.rawCode).toContain("clipboardHtml");
    expect(code.byMode.combined.rawCode).toContain("outerHTML");
    expect(code.byMode.combined.rawCode).not.toContain(".remove()");
    expect(code.byMode.combined.rawCode).not.toContain("selectedElement ? selectedElement.outerHTML : null");
  });

  test("copy: functions mode returns [selectedElement, clipboardHtml]", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Copied element" }],
    });
    expect(code.byMode.functions.rawCode).toContain("return [selectedElement, clipboardHtml]");
    expect(code.byMode.functions.rawCode).not.toContain("selectedElement ? selectedElement.outerHTML : null");
  });

  test("paste: combined mode calls insertAdjacentHTML", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Pasted element" }],
    });
    expect(code.byMode.combined.rawCode).toContain("insertAdjacentHTML");
    expect(code.byMode.combined.rawCode).toContain("clipboardHtml");
    expect(code.byMode.combined.rawCode).not.toContain("if (selectedElement && clipboardHtml)");
  });

  test("paste: functions mode accepts clipboardHtml param and returns it", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Pasted element" }],
    });
    expect(code.byMode.functions.rawCode).toContain("clipboardHtml");
    expect(code.byMode.functions.rawCode).toContain("insertAdjacentHTML");
    expect(code.byMode.functions.rawCode).not.toContain("if (selectedElement && clipboardHtml)");
  });

  test("apply-style: combined mode emits ps.applyStyle with cssValues", () => {
    const code = generate({
      entries: [
        { action: "Selected element", detail: "selector: .foo" },
        { action: "Applied style", detail: JSON.stringify({ color: "red", "font-size": "14px" }) },
      ],
    });
    expect(code.byMode.combined.rawCode).toContain("ps.applyStyle");
    expect(code.byMode.combined.rawCode).toContain('"color"');
    expect(code.byMode.combined.rawCode).toContain('"red"');
    expect(code.byMode.combined.rawCode).not.toContain("if (selectedElement)");
  });

  test("apply-style: functions mode emits ps.applyStyle and returns selectedElement", () => {
    const code = generate({
      entries: [
        { action: "Selected element", detail: "selector: .foo" },
        { action: "Applied style", detail: JSON.stringify({ color: "red" }) },
      ],
    });
    expect(code.byMode.functions.rawCode).toContain("ps.applyStyle");
    expect(code.byMode.functions.rawCode).toContain("return [selectedElement]");
    expect(code.byMode.functions.rawCode).not.toContain("if (selectedElement)");
  });

  test("hide: combined mode emits display none style application", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Hide element" }],
    });

    expect(code.byMode.combined.rawCode).toContain("ps.applyStyle");
    expect(code.byMode.combined.rawCode).toContain('"display"');
    expect(code.byMode.combined.rawCode).toContain('"none"');
    expect(code.byMode.combined.rawCode).not.toContain(".remove()");
    expect(code.byMode.combined.rawCode).not.toContain("if (selectedElement)");
  });

  test("hide: functions mode returns selectedElement after applying display none", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Hide element" }],
    });

    expect(code.byMode.functions.rawCode).toContain("ps.applyStyle");
    expect(code.byMode.functions.rawCode).toContain('"display"');
    expect(code.byMode.functions.rawCode).toContain('"none"');
    expect(code.byMode.functions.rawCode).toContain("return [selectedElement]");
    expect(code.byMode.functions.rawCode).not.toContain("if (selectedElement)");
  });

  test("delete code does not wrap remove() in a selectedElement null check", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Deleted element" }],
    });

    expect(code.byMode.combined.rawCode).toContain("selectedElement.remove()");
    expect(code.byMode.functions.rawCode).toContain("selectedElement.remove()");
    expect(code.byMode.combined.rawCode).not.toContain("if (selectedElement)");
    expect(code.byMode.functions.rawCode).not.toContain("if (selectedElement)");
  });

  test("clipboardHtml chains: select → copy → select → paste → paste", () => {
    const code = generate({
      entries: [
        { action: "Selected element", detail: "selector: .a" },
        { action: "Copied element" },
        { action: "Selected element", detail: "selector: .b" },
        { action: "Pasted element" },
        { action: "Selected element", detail: "selector: .c" },
        { action: "Pasted element" },
      ],
    });
    const fnCode = code.byMode.functions.rawCode;
    expect(fnCode.match(/insertAdjacentHTML/g)?.length).toBe(2);
    expect(fnCode).toContain("clipboardHtml");
  });

  test("combined mode does not seed selectedElement before the first step", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Clicked element" }],
      selectOptions: {
        "step-1": {
          mode: "wait-until-match",
        },
      },
    });

    expect(code.byMode.combined.rawCode).not.toContain("let selectedElement = null");
    expect(code.byMode.combined.rawCode).toContain("let selectedElement = await selector1.waitUntilMatch()");
    expect(code.byMode.combined.rawCode).not.toContain("\n\n");
  });

  test("default select mode uses onElementMatches", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Clicked element" }],
    });

    expect(code.byMode.combined.rawCode).toContain("selector1.onElementMatches(async (selectedElement) => {");
    expect(code.byMode.combined.rawCode).not.toContain("await selector1.waitUntilMatch()");
  });

  test("select observer mode wraps the remaining steps in combined mode", () => {
    const code = generate({
      entries: [
        { action: "Selected element", detail: "selector: .foo" },
        { action: "Copied element" },
        { action: "Selected element", detail: "selector: .bar" },
        { action: "Pasted element" },
      ],
      selectOptions: {
        "step-1": {
          mode: "on-element-matches",
        },
      },
    });

    expect(code.byMode.combined.rawCode).toContain("selector1.onElementMatches(async (selectedElement) => {");
    expect(code.byMode.combined.rawCode).not.toContain("let selectedElement = matchedElement");
    expect(code.byMode.combined.rawCode).toContain('selectedElement.insertAdjacentHTML("afterend", clipboardHtml)');
    expect(code.byMode.combined.rawCode).not.toContain("await selector1.waitUntilMatch()");
  });

  test("select observer mode keeps step helpers and emits a suffix runner in functions mode", () => {
    const code = generate({
      entries: [{ action: "Selected element", detail: "selector: .foo" }, { action: "Clicked element" }],
      selectOptions: {
        "step-1": {
          mode: "on-element-matches",
        },
      },
    });

    expect(code.byMode.functions.rawCode).toContain("async function step1()");
    expect(code.byMode.functions.rawCode).toContain("async function step2(selectedElement)");
    expect(code.byMode.functions.rawCode).toContain("async function runAfterStep1(selectedElement)");
    expect(code.byMode.functions.rawCode).toContain("selector.onElementMatches((selectedElement) => {");
    expect(code.byMode.functions.rawCode).toContain("void runAfterStep1(selectedElement)");
  });

  test("parent selector re-select mode uses pq.selector instead of traversal", () => {
    const code = generate({
      entries: [
        { action: "Selected element", detail: "selector: .child" },
        { action: "Selected parent element", detail: "selector: .parent" },
        { action: "Deleted element" },
      ],
      parentOptions: {
        "step-2": {
          mode: "selector-reselect",
          untilSelector: ".parent",
          count: 1,
        },
      },
    });

    expect(code.byMode.combined.rawCode).toContain("const selector2 = pq.selector({");
    expect(code.byMode.combined.rawCode).toContain('baseSelector: ".parent"');
    expect(code.byMode.combined.rawCode).toContain("matches: e => true");
    expect(code.byMode.combined.rawCode).not.toContain("Traverse until selector");
    expect(code.byMode.combined.rawCode).not.toContain("name:");
    expect(code.byMode.combined.rawCode).toContain("selector2.onElementMatches(async (selectedElement) => {");
    expect(code.byMode.combined.rawCode).not.toContain("await selector2.waitUntilMatch()");
    expect(code.byMode.combined.rawCode).not.toContain("pq.traverseParents");
  });

  test("mixed chains keep observer selection and parent selector re-select behavior", () => {
    const code = generate({
      entries: [
        { action: "Selected element", detail: "selector: .card" },
        { action: "Selected parent element", detail: "selector: .list" },
        { action: "Deleted element" },
      ],
      selectOptions: {
        "step-1": {
          mode: "on-element-matches",
        },
      },
      parentOptions: {
        "step-2": {
          mode: "selector-reselect",
          untilSelector: ".list",
          count: 1,
        },
      },
    });

    expect(code.byMode.combined.rawCode).toContain("selector1.onElementMatches(async (selectedElement) => {");
    expect(code.byMode.combined.rawCode).toContain("const selector2 = pq.selector({");
    expect(code.byMode.combined.rawCode).toContain("matches: e => true");
    expect(code.byMode.combined.rawCode).not.toContain("Traverse until selector");
    expect(code.byMode.combined.rawCode).not.toContain("name:");
    expect(code.byMode.combined.rawCode).toContain("selector2.onElementMatches(async (selectedElement) => {");
    expect(code.byMode.combined.rawCode).toContain("selectedElement.remove()");
  });
});
