import { getPqSelectorPreviewState } from "./pq-selector-preview";

type SelectorMatchPreviewControllerOptions = {
  getSelectorCode: () => string;
  isEnabled: () => boolean;
  onError?: (message: string | null) => void;
  onPreviewStateChange?: (previewing: boolean) => void;
  previewKey?: string;
  highlightClassName?: string;
  excludedAncestorSelector?: string;
};

export type SelectorMatchPreviewController = {
  mount: () => void;
  dispose: () => void;
  refresh: () => void;
  stop: () => void;
};

export const createSelectorMatchPreviewController = ({
  getSelectorCode,
  isEnabled,
  onError,
  onPreviewStateChange,
  previewKey = "z",
  highlightClassName = "pp-hovered",
  excludedAncestorSelector = ".pp-no-select-tool",
}: SelectorMatchPreviewControllerOptions): SelectorMatchPreviewController => {
  let previewing = false;
  let mounted = false;
  let highlightedElements: Element[] = [];

  const setPreviewState = (nextPreviewing: boolean) => {
    if (previewing === nextPreviewing) {
      return;
    }
    previewing = nextPreviewing;
    onPreviewStateChange?.(previewing);
  };

  const clearHighlights = () => {
    highlightedElements.forEach((element) => {
      element.classList.remove(highlightClassName);
    });
    highlightedElements = [];
  };

  const applyHighlights = () => {
    clearHighlights();

    const selectorCode = getSelectorCode();
    const previewState = getPqSelectorPreviewState(selectorCode, excludedAncestorSelector);
    onError?.(previewState.error);
    if (previewState.matchingElements.length === 0) {
      setPreviewState(false);
      return;
    }

    highlightedElements = previewState.matchingElements;
    highlightedElements.forEach((element) => {
      element.classList.add(highlightClassName);
    });
    setPreviewState(true);
  };

  const stop = () => {
    if (!previewing && highlightedElements.length === 0) {
      return;
    }
    clearHighlights();
    setPreviewState(false);
  };

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (!isEnabled()) {
      return;
    }
    if (event.key.toLowerCase() !== previewKey) {
      return;
    }
    if (previewing) {
      return;
    }
    applyHighlights();
  };

  const onWindowKeyUp = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== previewKey) {
      return;
    }
    stop();
  };

  const onWindowBlur = () => {
    stop();
  };

  const mount = () => {
    if (mounted) {
      return;
    }
    mounted = true;
    window.addEventListener("keydown", onWindowKeyDown, { capture: true });
    window.addEventListener("keyup", onWindowKeyUp, { capture: true });
    window.addEventListener("blur", onWindowBlur, { capture: true });
  };

  const dispose = () => {
    if (!mounted) {
      return;
    }
    mounted = false;
    window.removeEventListener("keydown", onWindowKeyDown, { capture: true });
    window.removeEventListener("keyup", onWindowKeyUp, { capture: true });
    window.removeEventListener("blur", onWindowBlur, { capture: true });
    stop();
  };

  const refresh = () => {
    if (!previewing) {
      return;
    }
    applyHighlights();
  };

  return {
    mount,
    dispose,
    refresh,
    stop,
  };
};
