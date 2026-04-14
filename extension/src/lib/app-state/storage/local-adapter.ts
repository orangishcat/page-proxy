import { browser } from "wxt/browser";
import { createStorageAdapter, type CreateStorageAdapterOptions } from "./create-storage-adapter";

export const createLocalStorageAdapter = <TRecord extends Record<string, unknown>>(
  options: Omit<CreateStorageAdapterOptions<TRecord>, "area">,
) => createStorageAdapter<TRecord>({ area: browser.storage.local, ...options });
