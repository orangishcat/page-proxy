const codeEditorFocusSelector =
  ".monaco-editor textarea.inputarea:focus, .monaco-diff-editor textarea.inputarea:focus";

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
};

export const isMonacoEditorTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest(".monaco-editor, .monaco-diff-editor"));
};

export const isCodeEditorFocused = (eventTarget: EventTarget | null): boolean => {
  if (isMonacoEditorTarget(eventTarget) || isMonacoEditorTarget(document.activeElement)) {
    return true;
  }

  return document.querySelector(codeEditorFocusSelector) !== null;
};
