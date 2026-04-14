import { browser } from "wxt/browser";
import { createStorageAdapter, type CreateStorageAdapterOptions } from "./create-storage-adapter";

export const createSessionStorageAdapter = <TRecord extends Record<string, unknown>>(
  options: Omit<CreateStorageAdapterOptions<TRecord>, "area">,
) => createStorageAdapter<TRecord>({ area: browser.storage.session, ...options });
