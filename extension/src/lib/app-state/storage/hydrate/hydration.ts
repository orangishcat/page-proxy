import { proxy } from "svelte/internal/client";

export const createStateProxy = proxy as <T extends object>(value: T) => T;

export const appStateStatus = createStateProxy({
  isAppStateHydrated: false,
  isApplyingRemoteSync: false,
});

export let isAppStateHydrated = false;
export let isApplyingRemoteSync = false;

export const setAppStateHydrated = (value: boolean) => {
  isAppStateHydrated = value;
  appStateStatus.isAppStateHydrated = value;
};

export const setApplyingRemoteSync = (value: boolean) => {
  isApplyingRemoteSync = value;
  appStateStatus.isApplyingRemoteSync = value;
};
