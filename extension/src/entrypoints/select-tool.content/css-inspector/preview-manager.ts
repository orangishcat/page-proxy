import type { MonacoCodeEditorHandle } from "@/lib/code-editor";
import { normalizeSelectorFromCssEditor, readDeclarationSourceFromCssEditor } from "./css-editor-utils";
import { getSelectorPreviewState } from "../popup/css-preview";

export type PreviewManagerDeps = {
  getCssEditorValue: () => string;
  getCssEditorHandle: () => MonacoCodeEditorHandle | null;
  setIsMatchPreviewing: (v: boolean) => void;
  setIsCssStylePreviewing: (v: boolean) => void;
  setHighlightedPreviewCount: (v: number) => void;
  setMatchingElementCount: (v: number) => void;
  setCssPreviewErrorMessage: (v: string | null) => void;
  getIsMatchPreviewing: () => boolean;
  getIsCssStylePreviewing: () => boolean;
};

const hoveredPreviewClass = "pp-hovered";

export const createPreviewManager = (deps: PreviewManagerDeps) => {
  let highlightedPreviewElements: Element[] = [];
  let highlightNoticeElement: HTMLDivElement | null = null;
  let cssStylePreviewElement: HTMLStyleElement | null = null;

  const getCssValue = () => deps.getCssEditorHandle()?.editor.getValue() ?? deps.getCssEditorValue();

  const clearPreviewHighlights = () => {
    highlightedPreviewElements.forEach((el) => el.classList.remove(hoveredPreviewClass));
    highlightedPreviewElements = [];
    deps.setHighlightedPreviewCount(0);
  };

  const updateCssPreviewState = () => {
    const previewState = getSelectorPreviewState(normalizeSelectorFromCssEditor(getCssValue()));
    deps.setMatchingElementCount(previewState.matchingElements.length);
    deps.setCssPreviewErrorMessage(previewState.error);
  };

  const applyPreviewHighlights = () => {
    clearPreviewHighlights();
    const previewState = getSelectorPreviewState(normalizeSelectorFromCssEditor(getCssValue()));
    deps.setMatchingElementCount(previewState.matchingElements.length);
    deps.setCssPreviewErrorMessage(previewState.error);
    if (previewState.matchingElements.length === 0) return;
    highlightedPreviewElements = previewState.matchingElements;
    deps.setHighlightedPreviewCount(highlightedPreviewElements.length);
    highlightedPreviewElements.forEach((el) => el.classList.add(hoveredPreviewClass));
  };

  const removeCssStylePreview = () => {
    cssStylePreviewElement?.remove();
    cssStylePreviewElement = null;
  };

  const applyCssStylePreview = () => {
    removeCssStylePreview();
    const currentDoc = getCssValue();
    const selector = normalizeSelectorFromCssEditor(currentDoc);
    const declarations = readDeclarationSourceFromCssEditor(currentDoc);
    if (!declarations.trim()) {
      deps.setCssPreviewErrorMessage("Add at least one CSS declaration to preview applied styles.");
      return;
    }
    const previewState = getSelectorPreviewState(selector);
    deps.setMatchingElementCount(previewState.matchingElements.length);
    deps.setCssPreviewErrorMessage(previewState.error);
    if (previewState.matchingElements.length === 0) return;
    const el = document.createElement("style");
    el.className = "pp-no-select-tool";
    el.setAttribute("data-page-proxy", "css-style-preview");
    el.textContent = `${selector} {\n${declarations}\n}`;
    (document.head ?? document.documentElement).appendChild(el);
    cssStylePreviewElement = el;
  };

  const stopMatchPreview = () => {
    if (!deps.getIsMatchPreviewing()) return;
    deps.setIsMatchPreviewing(false);
    clearPreviewHighlights();
  };

  const stopCssStylePreview = () => {
    if (!deps.getIsCssStylePreviewing()) return;
    deps.setIsCssStylePreviewing(false);
    removeCssStylePreview();
  };

  const stopAll = () => {
    stopMatchPreview();
    stopCssStylePreview();
  };

  const removeHighlightNotice = () => {
    highlightNoticeElement?.remove();
    highlightNoticeElement = null;
  };

  const showHighlightNotice = (matchCount: number) => {
    if (!highlightNoticeElement?.isConnected) {
      const notice = document.createElement("div");
      notice.className = "pp-no-select-tool";
      notice.style.position = "fixed";
      notice.style.top = "1em";
      notice.style.right = "1em";
      notice.style.zIndex = "2147483647";
      notice.style.pointerEvents = "none";
      notice.style.padding = "0.625em 0.75em";
      notice.style.borderRadius = "0.5em";
      notice.style.border = "0.0625em solid #86d24b";
      notice.style.background = "rgba(22, 30, 22, 0.96)";
      notice.style.color = "#e8f7e8";
      notice.style.fontFamily = "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";
      notice.style.setProperty("font-size", "16px", "important");
      notice.style.lineHeight = "1.3";
      notice.style.boxShadow = "0 0.25em 0.75em rgba(0, 0, 0, 0.35)";
      document.body.appendChild(notice);
      highlightNoticeElement = notice;
    }
    highlightNoticeElement.textContent = `${matchCount} matching elements are highlighted in lime.`;
  };

  return {
    updateCssPreviewState,
    applyPreviewHighlights,
    applyCssStylePreview,
    stopAll,
    removeHighlightNotice,
    showHighlightNotice,
    handleWindowKeyDown: (event: KeyboardEvent, active: boolean, isCssEditorFocused: boolean) => {
      if (!active || isCssEditorFocused) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !deps.getIsMatchPreviewing()) {
        deps.setIsMatchPreviewing(true);
        applyPreviewHighlights();
        return;
      }
      if (key === "x" && !deps.getIsCssStylePreviewing()) {
        deps.setIsCssStylePreviewing(true);
        applyCssStylePreview();
      }
    },
    handleWindowKeyUp: (event: KeyboardEvent, active: boolean) => {
      if (!active) return;
      const key = event.key.toLowerCase();
      if (key === "z") { stopMatchPreview(); return; }
      if (key === "x") { stopCssStylePreview(); }
    },
  };
};
