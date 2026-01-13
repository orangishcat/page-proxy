import {writable} from 'svelte/store';

export const errorMessage = writable<string | null>(null);

export const setErrorMessage = (message: string | null) => {
  errorMessage.set(message);
};
