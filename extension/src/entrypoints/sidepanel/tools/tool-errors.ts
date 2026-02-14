import {writable} from 'svelte/store';

export const errorMessage = writable<string | null>(null);
export const successMessage = writable<string | null>(null);

export const setErrorMessage = (message: string | null) => {
  if (message) {
    successMessage.set(null);
  }
  errorMessage.set(message);
};

export const setSuccessMessage = (message: string | null) => {
  if (message) {
    errorMessage.set(null);
  }
  successMessage.set(message);
};
