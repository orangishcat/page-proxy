import type { ElementInfo } from "@/lib/selection";
import { createMonacoEditor, type MonacoCodeEditorHandle } from "@/lib/code-editor";
import {
  buildCssDocument,
  normalizeSelectorFromCssEditor,
  readDeclarationSourceFromCssEditor,
} from "./css-editor-utils";
import log from "@/lib/logger";

const logger = log.getLogger("css-inspector");

export type CssEditorInitDeps = {
  getHost: () => HTMLDivElement | null;
  getHandle: () => MonacoCodeEditorHandle | null;
  setHandle: (v: MonacoCodeEditorHandle) => void;
  getCssEditorValue: () => string;
  setCssEditorValue: (v: string) => void;
  setHoveredCssOffset: (v: number | null) => void;
  setIsCssEditorFocused: (v: boolean) => void;
  setErrorMessage: (v: string) => void;
  onBaseSelectorChange?: (selector: string) => void;
  applyPreviewHighlights: () => void;
  applyCssStylePreview: () => void;
  updateCssPreviewState: () => void;
  getIsMatchPreviewing: () => boolean;
  getIsCssStylePreviewing: () => boolean;
  baseSelector: string;
  info: ElementInfo | null;
  initialCssContent?: string;
  initialCode?: string;
};

export const initCssEditor = (deps: CssEditorInitDeps): (() => void) | null => {
  const host = deps.getHost();
  if (!host || deps.getHandle()) return null;

  const initialDeclarationValue = readDeclarationSourceFromCssEditor(deps.getCssEditorValue());
  const initialSelectorValue = deps.baseSelector.trim() || deps.info?.selector || "body";
  const trimmedInitialCssContent = deps.initialCssContent?.trim() ?? "";
  const trimmedInitialCode = deps.initialCode?.trim() ?? "";
  const initialCssEditorValue =
    deps.getCssEditorValue().trim().length > 0
      ? deps.getCssEditorValue()
      : trimmedInitialCode.length > 0
        ? trimmedInitialCode
        : trimmedInitialCssContent.length > 0
          ? trimmedInitialCssContent
          : buildCssDocument(initialSelectorValue, initialDeclarationValue);

  logger.debug("Creating CSS Inspector editor", {
    initialDeclarationValue,
    initialSelectorValue,
    trimmedInitialCssContent,
    trimmedInitialCode,
    initialCssEditorValue,
  });

  deps.setCssEditorValue(initialCssEditorValue);
  const handle = createMonacoEditor(host, initialCssEditorValue, {
    language: "css",
    modelUri: "inmemory://page-proxy/selector-popup-base-selector.css",
    lineNumbers: "on",
    wordWrap: "on",
    onChange: (nextValue) => {
      deps.setCssEditorValue(nextValue);
      const normalizedSelectorValue = normalizeSelectorFromCssEditor(nextValue);
      if (normalizedSelectorValue.length === 0) {
        deps.setErrorMessage("CSS selector cannot be empty.");
        deps.updateCssPreviewState();
        return;
      }
      deps.onBaseSelectorChange?.(normalizedSelectorValue);
      deps.setErrorMessage("");
      if (deps.getIsMatchPreviewing()) deps.applyPreviewHighlights();
      if (deps.getIsCssStylePreviewing()) deps.applyCssStylePreview();
      deps.updateCssPreviewState();
    },
    editorOptions: {
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
    },
  });
  deps.setHandle(handle);

  const cursorChangeDisposable = handle.editor.onDidChangeCursorPosition((event) => {
    deps.setHoveredCssOffset(handle.model.getOffsetAt(event.position));
  });

  const initialPosition = handle.editor.getPosition();
  deps.setHoveredCssOffset(initialPosition ? handle.model.getOffsetAt(initialPosition) : null);

  const focusDisposable = handle.editor.onDidFocusEditorText(() => deps.setIsCssEditorFocused(true));
  const blurDisposable = handle.editor.onDidBlurEditorText(() => deps.setIsCssEditorFocused(false));

  deps.setIsCssEditorFocused(handle.editor.hasTextFocus());

  return () => {
    cursorChangeDisposable.dispose();
    focusDisposable.dispose();
    blurDisposable.dispose();
  };
};
