import { describe, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const runtimeMessageListeners = new Set<(...args: unknown[]) => unknown>();

void mock.module("wxt/browser", () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener: (listener: (...args: unknown[]) => unknown) => {
          runtimeMessageListeners.add(listener);
        },
        removeListener: (listener: (...args: unknown[]) => unknown) => {
          runtimeMessageListeners.delete(listener);
        },
      },
    },
  },
}));

const contentScriptRoot = resolve(import.meta.dir, "../src/entrypoints/select-tool.content");
const codeRunnerPath = resolve(import.meta.dir, "../src/entrypoints/code-runner-main-world.ts");

describe("content script memory cleanup", () => {
  test("message router returns a disposer that removes its runtime listener", async () => {
    runtimeMessageListeners.clear();
    const { addMessageListener } = await import("../src/entrypoints/select-tool.content/message-router");

    const removeMessageListener = addMessageListener({} as Parameters<typeof addMessageListener>[0]);

    expect(runtimeMessageListeners.size).toBe(1);

    removeMessageListener();

    expect(runtimeMessageListeners.size).toBe(0);
  });

  test("popup managers guard async opens against stale mounts", async () => {
    const { createOpenGenerationGate } = await import(
      "../src/entrypoints/select-tool.content/lifecycle/open-generation"
    );
    const gate = createOpenGenerationGate();

    const firstOpen = gate.begin();
    gate.invalidate();
    const secondOpen = gate.begin();

    expect(gate.isCurrent(firstOpen)).toBe(false);
    expect(gate.isCurrent(secondOpen)).toBe(true);
  });

  test("main-world runner avoids module-map and PP global retention", async () => {
    const source = await readFile(codeRunnerPath, "utf8");

    expect(source).not.toContain("URL.createObjectURL");
    expect(source).not.toContain("import(/* @vite-ignore */");
    expect(source).not.toContain("(globalThis as Record<string, unknown>).pa =");
    expect(source).not.toContain("(globalThis as Record<string, unknown>).pn =");
    expect(source).not.toContain("(globalThis as Record<string, unknown>).pq =");
    expect(source).not.toContain("(globalThis as Record<string, unknown>).ps =");
    expect(source).not.toContain("(globalThis as Record<string, unknown>).pt =");
    expect(source).not.toContain("(globalThis as Record<string, unknown>).pv =");
    expect(source).not.toContain("(globalThis as Record<string, unknown>).pp =");
  });

  test("content entrypoint registers invalidation cleanup", async () => {
    const source = await readFile(resolve(contentScriptRoot, "index.ts"), "utf8");

    expect(source).toContain("ctx.onInvalidated(cleanup)");
    expect(source).toContain("removeMessageListener()");
    expect(source).toContain("removeDebugMessageListener()");
  });
});
