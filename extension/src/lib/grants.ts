import { z } from "zod";

export const supportedScriptGrants = ["run-on-page-load"] as const;

export type ScriptGrantValue = (typeof supportedScriptGrants)[number];

const supportedScriptGrantSet = new Set<string>(supportedScriptGrants);
const ScriptGrantSchema = z.enum(supportedScriptGrants);

const normalizeGrantToken = (value: string) => value.trim().toLowerCase();
const normalizeGrantValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>);
  }

  return [];
};

export const ScriptGrantValuesSchema = z
  .unknown()
  .transform(normalizeGrantValues)
  .pipe(z.array(z.unknown()))
  .transform((values): ScriptGrantValue[] => {
    const parsed: ScriptGrantValue[] = [];
    values.forEach((item) => {
      if (typeof item !== "string") {
        return;
      }

      const normalized = normalizeGrantToken(item);
      if (!supportedScriptGrantSet.has(normalized)) {
        return;
      }

      const typedValue = ScriptGrantSchema.parse(normalized);
      if (!parsed.includes(typedValue)) {
        parsed.push(typedValue);
      }
    });

    return parsed;
  });

export const parseScriptGrantValues = (rawValue: string): ScriptGrantValue[] => {
  const tokens = rawValue
    .split(/[\s,]+/)
    .map((token) => normalizeGrantToken(token))
    .filter((token) => token.length > 0);

  const parsed: ScriptGrantValue[] = [];
  tokens.forEach((token) => {
    if (!supportedScriptGrantSet.has(token)) {
      throw new Error(`Unsupported @grant value "${token}". Supported values: ${supportedScriptGrants.join(", ")}.`);
    }

    const typedToken = token as ScriptGrantValue;
    if (!parsed.includes(typedToken)) {
      parsed.push(typedToken);
    }
  });

  return parsed;
};

export const coerceScriptGrantValues = (value: unknown): ScriptGrantValue[] => {
  return ScriptGrantValuesSchema.parse(value);
};

export const resolveEffectiveScriptGrants = (
  declaredGrants: ScriptGrantValue[],
  disableAllGrants: boolean,
  scriptEnabled = true,
): ScriptGrantValue[] => (disableAllGrants || !scriptEnabled ? [] : declaredGrants);

export const grantDocumentationLink = "https://orangishcat.github.io/page-proxy/docs/permissions";

export const grantDocumentationHashtags: Record<ScriptGrantValue, string> = {
  "run-on-page-load": "grant-run-on-page-load",
};

export const getGrantDocumentationUrl = (grant: ScriptGrantValue) =>
  `${grantDocumentationLink}#${grantDocumentationHashtags[grant]}`;
