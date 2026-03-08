type AutosaveOptions = {
  onSave: (content: string) => void;
  onPendingRefreshWarning: () => void;
  debounceMs?: number;
};

export type AutosaveManager = {
  schedule: (content: string) => void;
  saveNow: (content: string) => void;
  cancel: () => void;
  queuePendingTabRefresh: (editorValue: string, hasUnsavedChanges: boolean, isProgrammaticUpdate: boolean) => boolean;
  onSaveSuccess: () => boolean;
  dispose: () => void;
};

export const createAutosaveManager = (options: AutosaveOptions): AutosaveManager => {
  const { onSave, onPendingRefreshWarning, debounceMs = 3000 } = options;
  let saveTimer: number | null = null;
  let pendingContent: string | null = null;
  let hasPendingRefresh = false;
  let requiresManualSave = false;

  const flush = () => {
    saveTimer = null;
    if (pendingContent === null) {
      return;
    }
    const content = pendingContent;
    pendingContent = null;
    onSave(content);
  };

  const schedule = (content: string) => {
    pendingContent = content;
    if (requiresManualSave) {
      return;
    }
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(flush, debounceMs);
  };

  const saveNow = (content: string) => {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    pendingContent = null;
    onSave(content);
  };

  const queuePendingTabRefresh = (
    editorValue: string,
    hasUnsavedChanges: boolean,
    isProgrammaticUpdate: boolean,
  ): boolean => {
    if (!hasUnsavedChanges || isProgrammaticUpdate) {
      return false;
    }
    requiresManualSave = true;
    hasPendingRefresh = true;
    pendingContent = editorValue;
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    onPendingRefreshWarning();
    return true;
  };

  const onSaveSuccess = (): boolean => {
    const shouldRefresh = hasPendingRefresh;
    requiresManualSave = false;
    hasPendingRefresh = false;
    return shouldRefresh;
  };

  const cancel = () => {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    pendingContent = null;
  };

  const dispose = () => {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
  };

  return { schedule, saveNow, cancel, queuePendingTabRefresh, onSaveSuccess, dispose };
};
