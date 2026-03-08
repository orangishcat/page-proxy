import { writable } from "svelte/store";

export const recordConverterOpenError = writable<string | null>(null);

export const setRecordConverterOpenError = (message: string | null) => {
  recordConverterOpenError.set(message);
};

export const clearRecordConverterOpenError = () => {
  recordConverterOpenError.set(null);
};
