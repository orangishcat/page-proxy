import { describe, expect, test } from "bun:test";
import { get } from "svelte/store";
import {
  editorMessage,
  setEditorMessage,
  setToolMessage,
  toolMessage,
} from "../src/entrypoints/sidepanel/tools/tool-errors";

describe("sidepanel message stores", () => {
  test("setToolMessage stores tool-panel messages with status", () => {
    setToolMessage("Saved.", "success");

    expect(get(toolMessage)).toEqual({
      text: "Saved.",
      status: "success",
      stackTrace: null,
    });
    expect(get(editorMessage)).toBeNull();
  });

  test("setEditorMessage stores editor messages with stack traces", () => {
    setEditorMessage("Failed.", "error", "stack");

    expect(get(editorMessage)).toEqual({
      text: "Failed.",
      status: "error",
      stackTrace: "stack",
    });
  });

  test("clearing one channel does not clear the other", () => {
    setToolMessage("Tool notice.", "error");
    setEditorMessage("Editor notice.", "success");

    setToolMessage(null, "error");

    expect(get(toolMessage)).toBeNull();
    expect(get(editorMessage)).toEqual({
      text: "Editor notice.",
      status: "success",
      stackTrace: null,
    });
  });
});
