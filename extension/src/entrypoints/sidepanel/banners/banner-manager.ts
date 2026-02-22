import { browser } from "wxt/browser";

type StorageArea = Pick<typeof browser.storage.local, "get" | "set" | "remove">;

export type BannerDismissBehavior = "persist" | "session";

export type BannerDefinition = {
  id: string;
  storageKey?: string;
  dismissBehavior?: BannerDismissBehavior;
};

export type BannerManagerOptions = {
  storage?: StorageArea;
  storageKeyPrefix?: string;
  defaultDismissBehavior?: BannerDismissBehavior;
  dismissedValue?: unknown;
  isDismissedValue?: (storedValue: unknown, dismissedValue: unknown) => boolean;
  ignoreStorageErrors?: boolean;
  resolveStorageKey?: (banner: BannerDefinition, storageKeyPrefix: string) => string;
};

const defaultResolveStorageKey = (banner: BannerDefinition, storageKeyPrefix: string) =>
  banner.storageKey ?? `${storageKeyPrefix}${banner.id}`;

const defaultIsDismissedValue = (storedValue: unknown, dismissedValue: unknown) => storedValue === dismissedValue;

const resolveDismissBehavior = (banner: BannerDefinition, defaultDismissBehavior: BannerDismissBehavior) =>
  banner.dismissBehavior ?? defaultDismissBehavior;

const asStorageError = (action: string, key: string) => new Error(`Unable to ${action} banner setting "${key}".`);

export const createBannerManager = (options: BannerManagerOptions = {}) => {
  const storage = options.storage ?? browser.storage.local;
  const storageKeyPrefix = options.storageKeyPrefix ?? "sidepanel:";
  const defaultDismissBehavior = options.defaultDismissBehavior ?? "persist";
  const dismissedValue = options.dismissedValue ?? true;
  const isDismissedValue = options.isDismissedValue ?? defaultIsDismissedValue;
  const ignoreStorageErrors = options.ignoreStorageErrors ?? true;
  const resolveStorageKey = options.resolveStorageKey ?? defaultResolveStorageKey;

  const getStorageKey = (banner: BannerDefinition) => resolveStorageKey(banner, storageKeyPrefix);

  const isDismissed = async (banner: BannerDefinition) => {
    if (resolveDismissBehavior(banner, defaultDismissBehavior) === "session") {
      return false;
    }

    const key = getStorageKey(banner);
    return storage
      .get(key)
      .then((stored) => isDismissedValue(stored[key], dismissedValue))
      .catch(() => {
        if (ignoreStorageErrors) {
          return false;
        }

        throw asStorageError("read", key);
      });
  };

  const setDismissed = async (banner: BannerDefinition, dismissed: boolean) => {
    if (resolveDismissBehavior(banner, defaultDismissBehavior) === "session") {
      return;
    }

    const key = getStorageKey(banner);
    const operation = dismissed ? storage.set({ [key]: dismissedValue }) : storage.remove(key);
    await operation.catch(() => {
      if (ignoreStorageErrors) {
        return;
      }

      throw asStorageError(dismissed ? "save" : "clear", key);
    });
  };

  const dismiss = async (banner: BannerDefinition) => setDismissed(banner, true);

  const reset = async (banner: BannerDefinition) => setDismissed(banner, false);

  return {
    dismiss,
    getStorageKey,
    isDismissed,
    reset,
    setDismissed,
  };
};

export const createSidepanelBannerManager = (options: Omit<BannerManagerOptions, "storageKeyPrefix"> = {}) =>
  createBannerManager({
    storageKeyPrefix: "sidepanel:",
    ...options,
  });
