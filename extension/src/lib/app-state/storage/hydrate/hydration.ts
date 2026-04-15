import { proxy } from "svelte/internal/client";

export const createStateProxy = proxy as <T extends object>(value: T) => T;

export const appStateStatus = createStateProxy({
  isAppStateHydrated: false,
});

export let isAppStateHydrated = false;

export const setAppStateHydrated = (value: boolean) => {
  isAppStateHydrated = value;
  appStateStatus.isAppStateHydrated = value;
};
