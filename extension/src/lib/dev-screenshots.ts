export type DevScreenshotName =
  | "sidepanel"
  | "tool-panel"
  | "code-editor"
  | "select-actions-menu"
  | "selector-popup"
  | "css-inspector"
  | "record-converter";

export type DevScreenshotCaptureTarget = {
  element: object;
  name: DevScreenshotName;
};

type DevScreenshotSidepanelTargets = Record<"sidepanel" | "toolPanel" | "codeEditor", DevScreenshotCaptureTarget>;

type DevScreenshotDeps = {
  isDev: boolean;
  detectPopupCapture: () => Promise<DevScreenshotCaptureTarget | null>;
  getSidepanelTargets: () => DevScreenshotSidepanelTargets;
  capturePng: (target: object) => Promise<string>;
  downloadPng: (fileName: string, dataUrl: string) => void;
  now?: () => Date;
};

type ShortcutEventLike = Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "preventDefault">;

type ContentDevScreenshotDeps = {
  isDev: boolean;
  downloadPopupScreenshot: () => boolean;
  requestSidepanelScreenshot: () => void;
};

const formatPart = (value: number, size = 2) => value.toString().padStart(size, "0");

export const isDevScreenshotShortcut = (event: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">) =>
  event.code === "F12" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;

export const buildDevScreenshotFileName = (name: DevScreenshotName, date: Date) => {
  const year = date.getUTCFullYear();
  const month = formatPart(date.getUTCMonth() + 1);
  const day = formatPart(date.getUTCDate());
  const hour = formatPart(date.getUTCHours());
  const minute = formatPart(date.getUTCMinutes());
  const second = formatPart(date.getUTCSeconds());
  const millisecond = formatPart(date.getUTCMilliseconds(), 3);
  return `page-proxy-${name}-${year}-${month}-${day}-${hour}-${minute}-${second}-${millisecond}.png`;
};

export const downloadPngDataUrl = (fileName: string, dataUrl: string) => {
  const downloadAnchor = document.createElement("a");
  downloadAnchor.href = dataUrl;
  downloadAnchor.download = fileName;
  document.body.append(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

const measureCaptureSize = (element: Element) => {
  const rect = element.getBoundingClientRect();
  const widthCandidate = "scrollWidth" in element ? Number(element.scrollWidth) : 0;
  const heightCandidate = "scrollHeight" in element ? Number(element.scrollHeight) : 0;

  return {
    width: Math.max(Math.ceil(rect.width), Math.ceil(widthCandidate), 1),
    height: Math.max(Math.ceil(rect.height), Math.ceil(heightCandidate), 1),
  };
};

export const captureElementAsTransparentPng = async (element: Element) => {
  const { domToPng } = await import("modern-screenshot");
  const { width, height } = measureCaptureSize(element);
  const scale = Math.max(window.devicePixelRatio || 1, 1);

  return domToPng(element, {
    width,
    height,
    scale,
    backgroundColor: null,
  });
};

export const handleContentDevScreenshotShortcut = (
  event: ShortcutEventLike,
  { isDev, downloadPopupScreenshot, requestSidepanelScreenshot }: ContentDevScreenshotDeps,
) => {
  if (!isDev || !isDevScreenshotShortcut(event)) {
    return "ignored" as const;
  }

  event.preventDefault();
  if (downloadPopupScreenshot()) {
    return "popup" as const;
  }

  requestSidepanelScreenshot();
  return "sidepanel" as const;
};

export const takeDevScreenshots = async (
  event: ShortcutEventLike,
  { isDev, detectPopupCapture, getSidepanelTargets, capturePng, downloadPng, now = () => new Date() }: DevScreenshotDeps,
) => {
  if (!isDev || !isDevScreenshotShortcut(event)) {
    return "ignored" as const;
  }

  event.preventDefault();

  const timestamp = now();
  const popupCapture = await detectPopupCapture();
  if (popupCapture) {
    const dataUrl = await capturePng(popupCapture.element);
    downloadPng(buildDevScreenshotFileName(popupCapture.name, timestamp), dataUrl);
    return "popup" as const;
  }

  const sidepanelTargets = getSidepanelTargets();
  const captures = [sidepanelTargets.sidepanel, sidepanelTargets.toolPanel, sidepanelTargets.codeEditor];
  const images = await Promise.all(captures.map(async (capture) => [capture, await capturePng(capture.element)] as const));
  images.forEach(([capture, dataUrl]) => {
    downloadPng(buildDevScreenshotFileName(capture.name, timestamp), dataUrl);
  });

  return "sidepanel" as const;
};
