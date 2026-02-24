import { parseScriptGrantValues, type ScriptGrantValue } from "@/lib/grants";

export type ScriptMetadata = {
  title: string;
  website: string;
  websites: string[];
  description: string;
  author: string;
  credits: string;
  grants: ScriptGrantValue[];
};

const requiredMetadataFields = ["title", "website", "description"] as const;
const optionalMetadataFields = ["author", "credits", "grant"] as const;
const supportedMetadataFields = [...requiredMetadataFields, ...optionalMetadataFields] as const;
const multilineMetadataFields = ["description", "credits"] as const;

const metadataBlockPattern = /\/\/\s*==\s*Page\s*Proxy\s*==([\s\S]*?)\/\/\s*==\s*\/\s*Page\s*Proxy\s*==/gm;

export const parseScriptMetadata = (content: string): ScriptMetadata => {
  const blockMatch = content.match(metadataBlockPattern);
  if (!blockMatch) {
    throw new Error("Missing Page Proxy metadata block.");
  }

  const metadataBlock = blockMatch[0];
  const metadataMatch = metadataBlock.match(
    /\/\/\s*==\s*Page\s*Proxy\s*==([\s\S]*?)\/\/\s*==\s*\/\s*Page\s*Proxy\s*==/,
  );
  if (!metadataMatch) {
    throw new Error("Missing Page Proxy metadata block.");
  }

  const parsed: Record<(typeof supportedMetadataFields)[number], string> = {
    title: "",
    website: "",
    description: "",
    author: "",
    credits: "",
    grant: "",
  };
  const parsedWebsites: string[] = [];
  let parsedGrants: ScriptGrantValue[] = [];
  const seen = new Set<(typeof supportedMetadataFields)[number]>();
  let activeMultilineField: (typeof multilineMetadataFields)[number] | null = null;

  metadataMatch[1]
    .split("\n")
    .forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line.trim()) {
        return;
      }

      const metaMatch = line.match(/^\/\/\s*@([\w-]+)\s*:?\s*(.*)$/);
      if (metaMatch) {
        const [, key, value] = metaMatch;
        if (!supportedMetadataFields.includes(key as (typeof supportedMetadataFields)[number])) {
          activeMultilineField = null;
          return;
        }

        const typedKey = key as (typeof supportedMetadataFields)[number];

        if (typedKey === "website") {
          const normalizedWebsite = value.trim();
          if (normalizedWebsite.length > 0 && !parsedWebsites.includes(normalizedWebsite)) {
            parsedWebsites.push(normalizedWebsite);
          }

          if (!seen.has(typedKey)) {
            seen.add(typedKey);
            parsed[typedKey] = normalizedWebsite;
          }

          activeMultilineField = null;
          return;
        }

        if (seen.has(typedKey)) {
          throw new Error(`Duplicate @${typedKey} metadata field.`);
        }

        seen.add(typedKey);
        parsed[typedKey] = value.trim();
        if (typedKey === "grant") {
          parsedGrants = parseScriptGrantValues(value.trim());
        }
        activeMultilineField = multilineMetadataFields.includes(typedKey as (typeof multilineMetadataFields)[number])
          ? (typedKey as (typeof multilineMetadataFields)[number])
          : null;
        return;
      }

      const commentMatch = line.match(/^\/\/\s?(.*)$/);
      if (!commentMatch) {
        throw new Error(`Invalid metadata line: "${line}".`);
      }

      if (!activeMultilineField) {
        throw new Error(`Invalid metadata line: "${line}".`);
      }

      const continuationText = commentMatch[1].trim();
      if (!continuationText && parsed[activeMultilineField].length === 0) {
        return;
      }

      parsed[activeMultilineField] = `${parsed[activeMultilineField]}\n${continuationText}`.trim();
    });

  const missingFields = requiredMetadataFields.filter((field) => !seen.has(field));
  if (missingFields.length > 0) {
    throw new Error(
      `Invalid Page Proxy metadata block: missing ${missingFields.map((field) => `@${field}`).join(", ")}.`,
    );
  }

  return {
    title: parsed.title,
    website: parsedWebsites[0] ?? parsed.website,
    websites: parsedWebsites,
    description: parsed.description,
    author: parsed.author,
    credits: parsed.credits,
    grants: parsedGrants,
  };
};
