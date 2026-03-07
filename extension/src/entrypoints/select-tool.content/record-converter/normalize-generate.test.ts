import { describe, expect, test } from "bun:test";

import { buildGeneratedReviewCode } from "./generate";
import { normalizeRecordTimeline } from "./normalize";

describe("record converter click support", () => {
  test("normalizeRecordTimeline supports click action labels", () => {
    const normalized = normalizeRecordTimeline([
      { id: "entry-1", action: "Selected element", detail: "selector: button", timestamp: 1 },
      { id: "entry-2", action: "click", detail: "", timestamp: 2 },
      { id: "entry-3", action: "Clicked element", detail: "", timestamp: 3 },
    ]);

    expect(normalized.supportedSteps).toHaveLength(3);
    expect(normalized.supportedSteps.map((step) => step.kind)).toEqual(["select-element", "click-element", "click-element"]);
    expect(normalized.supportedSteps.map((step) => step.label)).toEqual(["Selected element", "Click element", "Click element"]);
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
});

describe("record converter: new step kinds — normalize", () => {
  test("normalizeRecordTimeline maps cut/copy/paste/apply-style actions", () => {
    const normalized = normalizeRecordTimeline([
      { id: "e1", action: "Selected element", detail: "selector: .foo", timestamp: 1 },
      { id: "e2", action: "Cut element", detail: "selector: .foo", timestamp: 2 },
      { id: "e3", action: "Selected element", detail: "selector: .bar", timestamp: 3 },
      { id: "e4", action: "Pasted element", detail: "", timestamp: 4 },
      { id: "e5", action: "Selected element", detail: "selector: .baz", timestamp: 5 },
      { id: "e6", action: "Copied element", detail: "", timestamp: 6 },
      { id: "e7", action: "Applied style", detail: JSON.stringify({ color: "red" }), timestamp: 7 },
    ]);

    expect(normalized.supportedSteps.map((s) => s.kind)).toEqual([
      "select-element",
      "cut-element",
      "select-element",
      "paste-element",
      "select-element",
      "copy-element",
      "apply-style-element",
    ]);
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

  const generate = (entries: { action: string; detail?: string }[]) => {
    const { supportedSteps } = normalizeRecordTimeline(makeTimeline(entries));
    return buildGeneratedReviewCode({ steps: supportedSteps, parentOptions: {}, existingCode: "", defaultParentUntilSelector: "body" });
  };

  test("cut: combined mode removes element and nulls selectedElement", () => {
    const code = generate([
      { action: "Selected element", detail: "selector: .foo" },
      { action: "Cut element" },
    ]);
    expect(code.byMode.combined.rawCode).toContain("clipboardHtml");
    expect(code.byMode.combined.rawCode).toContain(".remove()");
    expect(code.byMode.combined.rawCode).toContain("selectedElement = null");
  });

  test("cut: functions mode returns [null, clipboardHtml]", () => {
    const code = generate([
      { action: "Selected element", detail: "selector: .foo" },
      { action: "Cut element" },
    ]);
    expect(code.byMode.functions.rawCode).toContain("clipboardHtml");
    expect(code.byMode.functions.rawCode).toContain(".remove()");
    expect(code.byMode.functions.rawCode).toContain("return [null, clipboardHtml]");
  });

  test("copy: combined mode captures outerHTML", () => {
    const code = generate([
      { action: "Selected element", detail: "selector: .foo" },
      { action: "Copied element" },
    ]);
    expect(code.byMode.combined.rawCode).toContain("clipboardHtml");
    expect(code.byMode.combined.rawCode).toContain("outerHTML");
    expect(code.byMode.combined.rawCode).not.toContain(".remove()");
  });

  test("copy: functions mode returns [selectedElement, clipboardHtml]", () => {
    const code = generate([
      { action: "Selected element", detail: "selector: .foo" },
      { action: "Copied element" },
    ]);
    expect(code.byMode.functions.rawCode).toContain("return [selectedElement, clipboardHtml]");
  });

  test("paste: combined mode calls insertAdjacentHTML", () => {
    const code = generate([
      { action: "Selected element", detail: "selector: .foo" },
      { action: "Pasted element" },
    ]);
    expect(code.byMode.combined.rawCode).toContain("insertAdjacentHTML");
    expect(code.byMode.combined.rawCode).toContain("clipboardHtml");
  });

  test("paste: functions mode accepts clipboardHtml param and returns it", () => {
    const code = generate([
      { action: "Selected element", detail: "selector: .foo" },
      { action: "Pasted element" },
    ]);
    expect(code.byMode.functions.rawCode).toContain("clipboardHtml");
    expect(code.byMode.functions.rawCode).toContain("insertAdjacentHTML");
  });

  test("apply-style: combined mode emits ps.applyStyle with cssValues", () => {
    const code = generate([
      { action: "Selected element", detail: "selector: .foo" },
      { action: "Applied style", detail: JSON.stringify({ color: "red", "font-size": "14px" }) },
    ]);
    expect(code.byMode.combined.rawCode).toContain("ps.applyStyle");
    expect(code.byMode.combined.rawCode).toContain('"color"');
    expect(code.byMode.combined.rawCode).toContain('"red"');
  });

  test("apply-style: functions mode emits ps.applyStyle and returns selectedElement", () => {
    const code = generate([
      { action: "Selected element", detail: "selector: .foo" },
      { action: "Applied style", detail: JSON.stringify({ color: "red" }) },
    ]);
    expect(code.byMode.functions.rawCode).toContain("ps.applyStyle");
    expect(code.byMode.functions.rawCode).toContain("return [selectedElement]");
  });

  test("clipboardHtml chains: select → copy → select → paste → paste", () => {
    const code = generate([
      { action: "Selected element", detail: "selector: .a" },
      { action: "Copied element" },
      { action: "Selected element", detail: "selector: .b" },
      { action: "Pasted element" },
      { action: "Selected element", detail: "selector: .c" },
      { action: "Pasted element" },
    ]);
    const fnCode = code.byMode.functions.rawCode;
    expect(fnCode.match(/insertAdjacentHTML/g)?.length).toBe(2);
    expect(fnCode).toContain("clipboardHtml");
  });
});
