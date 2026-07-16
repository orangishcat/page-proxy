import { describe, expect, test } from "bun:test";

import {
  hashScriptCode,
  markScriptInjected,
  scriptIdAttribute,
  scriptInjectionTagName,
} from "../src/lib/script-injection-marker";

class TestElement {
  readonly attributes = new Map<string, string>();

  constructor(readonly tagName: string) {}

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

const createTestDocument = () => {
  const elements: TestElement[] = [];
  const document = {
    head: {
      append: (element: TestElement) => elements.push(element),
    },
    documentElement: null,
    createElement: (tagName: string) => new TestElement(tagName),
    querySelector: (selector: string) => {
      const match = selector.match(/^([^[]+)\[([^=]+)="([^"]+)"\]$/);
      if (!match) return null;
      const [, tagName, attribute, value] = match;
      return elements.find(
        (element) => element.tagName === tagName && element.attributes.get(attribute) === value,
      );
    },
  } as unknown as Document;

  return { document, elements };
};

describe("script injection marker", () => {
  test("uses a stable hash of the exact script code", () => {
    expect(hashScriptCode("console.log('one')")).toBe(hashScriptCode("console.log('one')"));
    expect(hashScriptCode("console.log('one')")).not.toBe(hashScriptCode("console.log('two')"));
  });

  test("aborts when the same script was already injected", () => {
    const { document, elements } = createTestDocument();
    const code = "console.log('one')";

    expect(markScriptInjected(document, code)).toBe(true);
    expect(markScriptInjected(document, code)).toBe(false);
    expect(elements).toHaveLength(1);
    expect(elements[0]?.tagName).toBe(scriptInjectionTagName);
    expect(elements[0]?.attributes.get(scriptIdAttribute)).toBe(hashScriptCode(code));
  });

  test("allows different scripts to be injected", () => {
    const { document, elements } = createTestDocument();

    expect(markScriptInjected(document, "console.log('one')")).toBe(true);
    expect(markScriptInjected(document, "console.log('two')")).toBe(true);
    expect(elements).toHaveLength(2);
  });
});
