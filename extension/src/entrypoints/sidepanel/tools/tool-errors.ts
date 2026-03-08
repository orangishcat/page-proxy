import { writable } from "svelte/store";

export type SidepanelMessageStatus = "success" | "error";

export type SidepanelMessage = {
  text: string;
  status: SidepanelMessageStatus;
  stackTrace: string | null;
};

const createMessageStore = () => writable<SidepanelMessage | null>(null);

export const toolMessage = createMessageStore();
export const editorMessage = createMessageStore();

const setScopedMessage = (
  store: typeof toolMessage,
  message: string | null,
  status: SidepanelMessageStatus,
  stackTrace: string | null = null,
) => {
  if (message === null) {
    store.set(null);
    return;
  }

  store.set({
    text: message,
    status,
    stackTrace: status === "error" ? stackTrace : null,
  });
};

export const setToolMessage = (
  message: string | null,
  status: SidepanelMessageStatus,
  stackTrace: string | null = null,
) => {
  setScopedMessage(toolMessage, message, status, stackTrace);
};

export const setEditorMessage = (
  message: string | null,
  status: SidepanelMessageStatus,
  stackTrace: string | null = null,
) => {
  setScopedMessage(editorMessage, message, status, stackTrace);
};

export const setEditorMessageFromUnknown = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error) {
    setEditorMessage(error.message || fallbackMessage, "error", typeof error.stack === "string" ? error.stack : null);
    return;
  }

  if (typeof error === "string") {
    const normalized = error.trim();
    setEditorMessage(normalized.length > 0 ? normalized : fallbackMessage, "error");
    return;
  }

  setEditorMessage(fallbackMessage, "error");
};
