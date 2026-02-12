export type ScriptMetadata = {
  title: string;
  website: string;
  description: string;
  author: string;
  credits: string;
};

const requiredMetadataFields = ["title", "website", "description"] as const;
const optionalMetadataFields = ["author", "credits"] as const;
const supportedMetadataFields = [...requiredMetadataFields, ...optionalMetadataFields] as const;

const metadataBlockPattern = /\/\/\s*==\s*Page\s*Proxy\s*==([\s\S]*?)\/\/\s*==\s*\/\s*Page\s*Proxy\s*==/gm;

export const parseScriptMetadata = (content: string): ScriptMetadata => {
  const match = content.match(metadataBlockPattern);
  if (!match) {
    throw new Error("Missing Page Proxy metadata block.");
  }

  const parsed: Record<(typeof supportedMetadataFields)[number], string> = {
    title: "",
    website: "",
    description: "",
    author: "",
    credits: "",
  };
  const seen = new Set<(typeof supportedMetadataFields)[number]>();

  match[0]
    .split("\n")
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line) {
        return;
      }

      if (line.match(/^\/\/\s*==(\/|)Page\s*Proxy\s*==$/)) {
        return;
      }
      const metaMatch = line.match(/^\/\/\s*@([\w-]+)\s*:?\s*(.*)$/);
      if (!metaMatch) {
        throw new Error(`Invalid metadata line: "${line}".`);
      }

      const [, key, value] = metaMatch;
      if (!supportedMetadataFields.includes(key as (typeof supportedMetadataFields)[number])) {
        return;
      }

      const typedKey = key as (typeof supportedMetadataFields)[number];
      if (seen.has(typedKey)) {
        throw new Error(`Duplicate @${typedKey} metadata field.`);
      }

      seen.add(typedKey);
      parsed[typedKey] = value.trim();
    });

  const missingFields = requiredMetadataFields.filter((field) => !seen.has(field));
  if (missingFields.length > 0) {
    throw new Error(
      `Invalid Page Proxy metadata block: missing ${missingFields.map((field) => `@${field}`).join(", ")}.`,
    );
  }

  return {
    title: parsed.title,
    website: parsed.website,
    description: parsed.description,
    author: parsed.author,
    credits: parsed.credits,
  };
};
