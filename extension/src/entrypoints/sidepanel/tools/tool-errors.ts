import {writable} from 'svelte/store';

export const errorMessage = writable<string | null>(null);
export const errorStackTrace = writable<string | null>(null);
export const successMessage = writable<string | null>(null);

export const setErrorMessage = (message: string | null, stackTrace: string | null = null) => {
  if (message) {
    successMessage.set(null);
  }
  errorMessage.set(message);
  errorStackTrace.set(message ? stackTrace : null);
};

export const setSuccessMessage = (message: string | null) => {
  if (message) {
    errorMessage.set(null);
    errorStackTrace.set(null);
  }
  successMessage.set(message);
};

export const setErrorFromUnknown = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error) {
    setErrorMessage(error.message || fallbackMessage, typeof error.stack === 'string' ? error.stack : null);
    return;
  }

  if (typeof error === 'string') {
    const normalized = error.trim();
    setErrorMessage(normalized.length > 0 ? normalized : fallbackMessage);
    return;
  }

  setErrorMessage(fallbackMessage);
};
