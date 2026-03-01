export const readClipboardText = async (): Promise<string | null> => {
  if (!window.isSecureContext || typeof navigator.clipboard?.readText !== "function") return null;
  return navigator.clipboard.readText();
};

export const writeClipboardText = async (value: string): Promise<boolean> => {
  if (!window.isSecureContext || typeof navigator.clipboard?.writeText !== "function") return false;
  await navigator.clipboard.writeText(value);
  return true;
};
