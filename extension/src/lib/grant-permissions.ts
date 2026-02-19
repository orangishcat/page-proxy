import { supportedScriptGrants, type ScriptGrantValue } from "@/lib/grants";

export type GrantPermissionRequestPayload = {
  websiteGlob: string;
  grants: ScriptGrantValue[];
};

export type GrantPermissionRequestMessage = {
  type: "grant:request";
  payload: GrantPermissionRequestPayload;
};

export type GrantPermissionResolveMessage = {
  type: "grant:resolve";
  payload: GrantPermissionRequestPayload & {
    allow: boolean;
  };
};

export type GrantPermissionResolveResult =
  | {
      ok: true;
      allowedGrants: ScriptGrantValue[];
    }
  | {
      ok: false;
      error: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const supportedScriptGrantSet = new Set<string>(supportedScriptGrants);

const isScriptGrantArray = (value: unknown): value is ScriptGrantValue[] =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "string" && supportedScriptGrantSet.has(item));

export const isGrantPermissionRequestMessage = (value: unknown): value is GrantPermissionRequestMessage => {
  if (!isRecord(value) || value.type !== "grant:request") {
    return false;
  }

  const payload = value.payload;
  if (!isRecord(payload)) {
    return false;
  }

  return typeof payload.websiteGlob === "string" && payload.websiteGlob.trim().length > 0 && isScriptGrantArray(payload.grants);
};

export const isGrantPermissionResolveMessage = (value: unknown): value is GrantPermissionResolveMessage => {
  if (!isRecord(value) || value.type !== "grant:resolve") {
    return false;
  }

  const payload = value.payload;
  if (!isRecord(payload)) {
    return false;
  }

  return (
    typeof payload.websiteGlob === "string" &&
    payload.websiteGlob.trim().length > 0 &&
    isScriptGrantArray(payload.grants) &&
    typeof payload.allow === "boolean"
  );
};
