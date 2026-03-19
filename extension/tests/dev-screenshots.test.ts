import { describe, expect, mock, test } from "bun:test";

import {
  handleContentDevScreenshotShortcut,
  isDevScreenshotShortcut,
  takeDevScreenshots,
  type DevScreenshotCaptureTarget,
} from "../src/lib/dev-screenshots";

const buildShortcutEvent = (overrides: Partial<KeyboardEvent> = {}) => {
  const preventDefault = mock(() => undefined);

  return {
    event: ({
      code: "F12",
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault,
      ...overrides,
    }) as unknown as KeyboardEvent,
    preventDefault,
  };
};

const sidepanelTargets: Record<"sidepanel" | "toolPanel" | "codeEditor", DevScreenshotCaptureTarget> = {
  sidepanel: { element: { id: "sidepanel-root" }, name: "sidepanel" },
  toolPanel: { element: { id: "tool-panel-root" }, name: "tool-panel" },
  codeEditor: { element: { id: "code-editor-root" }, name: "code-editor" },
};

describe("isDevScreenshotShortcut", () => {
  test("matches cmd+f12", () => {
    expect(isDevScreenshotShortcut(buildShortcutEvent().event)).toBe(true);
  });

  test("matches ctrl+f12", () => {
    expect(isDevScreenshotShortcut(buildShortcutEvent({ metaKey: false, ctrlKey: true }).event)).toBe(true);
  });

  test("rejects modified shortcuts", () => {
    expect(isDevScreenshotShortcut(buildShortcutEvent({ altKey: true }).event)).toBe(false);
    expect(isDevScreenshotShortcut(buildShortcutEvent({ shiftKey: true }).event)).toBe(false);
    expect(isDevScreenshotShortcut(buildShortcutEvent({ code: "F11" }).event)).toBe(false);
  });
});

describe("takeDevScreenshots", () => {
  test("ignores the shortcut outside development mode", async () => {
    const { event, preventDefault } = buildShortcutEvent();
    const capturePng = mock(() => Promise.resolve("data:image/png;base64,abc"));
    const downloadPng = mock(() => undefined);

    const result = await takeDevScreenshots(event, {
      isDev: false,
      detectPopupCapture: () => Promise.resolve(null),
      getSidepanelTargets: () => sidepanelTargets,
      capturePng,
      downloadPng,
      now: () => new Date("2026-03-17T10:11:12.123Z"),
    });

    expect(result).toBe("ignored");
    expect(capturePng).not.toHaveBeenCalled();
    expect(downloadPng).not.toHaveBeenCalled();
    expect(preventDefault.mock.calls).toHaveLength(0);
  });

  test("exports three named screenshots when no popup is open", async () => {
    const { event, preventDefault } = buildShortcutEvent();
    const capturePng = mock((target: object) => Promise.resolve(`png:${(target as { id: string }).id}`));
    const downloadPng = mock(() => undefined);

    const result = await takeDevScreenshots(event, {
      isDev: true,
      detectPopupCapture: () => Promise.resolve(null),
      getSidepanelTargets: () => sidepanelTargets,
      capturePng,
      downloadPng,
      now: () => new Date("2026-03-17T10:11:12.123Z"),
    });

    expect(result).toBe("sidepanel");
    expect(preventDefault.mock.calls).toHaveLength(1);
    expect(capturePng).toHaveBeenCalledTimes(3);
    expect(downloadPng.mock.calls as unknown as Array<[string, string]>).toEqual([
      ["page-proxy-sidepanel-2026-03-17-10-11-12-123.png", "png:sidepanel-root"],
      ["page-proxy-tool-panel-2026-03-17-10-11-12-123.png", "png:tool-panel-root"],
      ["page-proxy-code-editor-2026-03-17-10-11-12-123.png", "png:code-editor-root"],
    ]);
  });

  test("exports only the popup screenshot when one is open", async () => {
    const { event, preventDefault } = buildShortcutEvent();
    const capturePng = mock((target: object) => Promise.resolve(`png:${(target as { id: string }).id}`));
    const downloadPng = mock(() => undefined);

    const result = await takeDevScreenshots(event, {
      isDev: true,
      detectPopupCapture: () =>
        Promise.resolve({
          element: { id: "selector-popup-root" },
          name: "selector-popup",
        }),
      getSidepanelTargets: () => sidepanelTargets,
      capturePng,
      downloadPng,
      now: () => new Date("2026-03-17T10:11:12.123Z"),
    });

    expect(result).toBe("popup");
    expect(preventDefault.mock.calls).toHaveLength(1);
    expect(capturePng.mock.calls).toEqual([[{ id: "selector-popup-root" }]]);
    expect(downloadPng.mock.calls as unknown as Array<[string, string]>).toEqual([
      ["page-proxy-selector-popup-2026-03-17-10-11-12-123.png", "png:selector-popup-root"],
    ]);
  });

  test("exports a named sidepanel popup screenshot instead of the full sidepanel set", async () => {
    const { event, preventDefault } = buildShortcutEvent();
    const capturePng = mock((target: object) => Promise.resolve(`png:${(target as { id: string }).id}`));
    const downloadPng = mock(() => undefined);

    const result = await takeDevScreenshots(event, {
      isDev: true,
      detectPopupCapture: () =>
        Promise.resolve({
          element: { id: "select-actions-menu-root" },
          name: "select-actions-menu",
        }),
      getSidepanelTargets: () => sidepanelTargets,
      capturePng,
      downloadPng,
      now: () => new Date("2026-03-17T10:11:12.123Z"),
    });

    expect(result).toBe("popup");
    expect(preventDefault.mock.calls).toHaveLength(1);
    expect(downloadPng.mock.calls as unknown as Array<[string, string]>).toEqual([
      ["page-proxy-select-actions-menu-2026-03-17-10-11-12-123.png", "png:select-actions-menu-root"],
    ]);
  });
});

describe("handleContentDevScreenshotShortcut", () => {
  test("requests a sidepanel screenshot when no popup is open and the page has focus", () => {
    const { event, preventDefault } = buildShortcutEvent();
    const requestSidepanelScreenshot = mock(() => undefined);
    const downloadPopupScreenshot = mock(() => false);

    const result = handleContentDevScreenshotShortcut(event, {
      isDev: true,
      downloadPopupScreenshot,
      requestSidepanelScreenshot,
    });

    expect(result).toBe("sidepanel");
    expect(preventDefault.mock.calls).toHaveLength(1);
    expect(downloadPopupScreenshot.mock.calls).toHaveLength(1);
    expect(requestSidepanelScreenshot.mock.calls).toHaveLength(1);
  });
});
