import { writable } from "svelte/store";

import type { ScriptGrantValue } from "@/lib/grants";

export type GrantPermissionRequestState = {
  websiteGlob: string;
  grants: ScriptGrantValue[];
} | null;

export const grantPermissionRequest = writable<GrantPermissionRequestState>(null);

export const clearGrantPermissionRequest = () => {
  grantPermissionRequest.set(null);
};

