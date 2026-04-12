import { describe, expect, test } from "bun:test";

import { getShortcutTool } from "../src/lib/utils/keyboard-shortcuts";

const createKeyboardEvent = (code: string, init: Partial<KeyboardEvent> = {}) =>
  ({
    code,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...init,
  }) as KeyboardEvent;

describe("keyboard shortcuts", () => {
  test("maps Shift+1 through Shift+5 to the visible toolbar tools", () => {
    expect(getShortcutTool(createKeyboardEvent("Digit1", { shiftKey: true }))).toBe("select");
    expect(getShortcutTool(createKeyboardEvent("Digit2", { shiftKey: true }))).toBe("selectors");
    expect(getShortcutTool(createKeyboardEvent("Digit3", { shiftKey: true }))).toBe("record");
    expect(getShortcutTool(createKeyboardEvent("Digit4", { shiftKey: true }))).toBe("settings");
    expect(getShortcutTool(createKeyboardEvent("Digit5", { shiftKey: true }))).toBe("share");
  });

  test("ignores shortcuts when modifier keys other than Shift are pressed", () => {
    expect(getShortcutTool(createKeyboardEvent("Digit1"))).toBeNull();
    expect(getShortcutTool(createKeyboardEvent("Digit1", { shiftKey: true, metaKey: true }))).toBeNull();
    expect(getShortcutTool(createKeyboardEvent("Digit1", { shiftKey: true, ctrlKey: true }))).toBeNull();
    expect(getShortcutTool(createKeyboardEvent("Digit1", { shiftKey: true, altKey: true }))).toBeNull();
  });
});
