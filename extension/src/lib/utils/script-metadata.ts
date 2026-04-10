import { parseScriptGrantValues, type ScriptGrantValue } from "@/lib/grants";

export type ScriptMetadata = {
  title: string;
  website: string;
  websites: string[];
  description: string;
  version: string;
  author: string;
  credits: string;
  grants: ScriptGrantValue[];
};

const requiredMetadataFields = ["title", "website", "description"] as const;
const optionalMetadataFields = ["version", "author", "credits", "grant"] as const;
const supportedMetadataFields = [...requiredMetadataFields, ...optionalMetadataFields] as const;
const multilineMetadataFields = ["website", "description", "credits"] as const;

const metadataBlockPattern = /\/\/\s*==\s*Page\s*Proxy\s*==([\s\S]*?)\/\/\s*==\s*\/\s*Page\s*Proxy\s*==/gm;
const metadataBlockStartLinePattern = /^\/\/\s*==\s*Page\s*Proxy\s*==\s*$/;
const metadataBlockEndLinePattern = /^\/\/\s*==\s*\/\s*Page\s*Proxy\s*==\s*$/;
const metadataWebsiteLinePattern = /^(\s*\/\/\s*)@website(?:\s*:?\s*(.*))?$/;
const metadataFieldLinePattern = /^\s*\/\/\s*@[\w-]+/;
const metadataCommentLinePattern = /^(\s*\/\/\s?)(.*)$/;

const appendUniqueWebsite = (parsedWebsites: string[], websiteValue: string) => {
  const normalizedWebsite = websiteValue.trim();
  if (normalizedWebsite.length === 0 || parsedWebsites.includes(normalizedWebsite)) {
    return;
  }

  parsedWebsites.push(normalizedWebsite);
};

export const extractWebsiteMetadataGlobs = (content: string): string[] => {
  const lines = content.split("\n");
  const startIndex = lines.findIndex((line) => metadataBlockStartLinePattern.test(line.trim()));
  if (startIndex === -1) {
    return [];
  }

  const endIndex = lines.findIndex(
    (line, index) => index > startIndex && metadataBlockEndLinePattern.test(line.trim()),
  );
  if (endIndex === -1) {
    return [];
  }

  const parsedWebsites: string[] = [];
  let activeWebsiteField = false;

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const line = lines[index];
    const websiteLineMatch = line.match(metadataWebsiteLinePattern);
    if (websiteLineMatch) {
      appendUniqueWebsite(parsedWebsites, websiteLineMatch[2] ?? "");
      activeWebsiteField = true;
      continue;
    }

    if (metadataFieldLinePattern.test(line.trim())) {
      activeWebsiteField = false;
      continue;
    }

    if (!activeWebsiteField) {
      continue;
    }

    const continuationMatch = line.match(metadataCommentLinePattern);
    if (!continuationMatch) {
      activeWebsiteField = false;
      continue;
    }

    appendUniqueWebsite(parsedWebsites, continuationMatch[2] ?? "");
  }

  return parsedWebsites;
};

export const buildWebsiteMetadataListing = (websiteGlobs: string[], fallbackWebsiteGlob: string): string => {
  if (websiteGlobs.length > 0) {
    return websiteGlobs.join("\n");
  }

  return fallbackWebsiteGlob.trim();
};

export const normalizeScriptMetadataWebsites = (content: string): string => {
  const lines = content.split("\n");
  const startIndex = lines.findIndex((line) => metadataBlockStartLinePattern.test(line.trim()));
  if (startIndex === -1) {
    return content;
  }

  const endIndex = lines.findIndex(
    (line, index) => index > startIndex && metadataBlockEndLinePattern.test(line.trim()),
  );
  if (endIndex === -1) {
    return content;
  }

  const websiteLineIndexes: number[] = [];
  const parsedWebsites: string[] = [];
  let insertAtIndex: number | null = null;
  let websitePrefix: string | null = null;
  let activeWebsiteField = false;

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const line = lines[index];
    const websiteLineMatch = line.match(metadataWebsiteLinePattern);
    if (websiteLineMatch) {
      if (insertAtIndex === null) {
        insertAtIndex = index;
      }
      websitePrefix = websitePrefix ?? websiteLineMatch[1] ?? "// ";
      appendUniqueWebsite(parsedWebsites, websiteLineMatch[2] ?? "");
      websiteLineIndexes.push(index);
      activeWebsiteField = true;
      continue;
    }

    if (metadataFieldLinePattern.test(line.trim())) {
      activeWebsiteField = false;
      continue;
    }

    if (!activeWebsiteField) {
      continue;
    }

    const continuationMatch = line.match(metadataCommentLinePattern);
    if (!continuationMatch) {
      activeWebsiteField = false;
      continue;
    }

    websitePrefix = websitePrefix ?? continuationMatch[1] ?? "// ";
    appendUniqueWebsite(parsedWebsites, continuationMatch[2] ?? "");
    websiteLineIndexes.push(index);
  }

  if (insertAtIndex === null || websiteLineIndexes.length === 0) {
    return content;
  }

  const replacementLines =
    parsedWebsites.length > 0
      ? [
        `${websitePrefix ?? "// "}@website ${parsedWebsites[0]}`,
        ...parsedWebsites.slice(1).map((websiteGlob) => `${websitePrefix ?? "// "}${websiteGlob}`),
      ]
      : [`${websitePrefix ?? "// "}@website`];

  const websiteIndexSet = new Set<number>(websiteLineIndexes);
  const normalizedLines: string[] = [];
  let hasInsertedReplacement = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (!websiteIndexSet.has(index)) {
      normalizedLines.push(lines[index]);
      continue;
    }

    if (!hasInsertedReplacement && index === insertAtIndex) {
      normalizedLines.push(...replacementLines);
      hasInsertedReplacement = true;
    }
  }

  return normalizedLines.join("\n");
};

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
    version: "",
    author: "",
    credits: "",
    grant: "",
  };
  const parsedWebsites: string[] = [];
  let parsedGrants: ScriptGrantValue[] = [];
  const seen = new Set<(typeof supportedMetadataFields)[number]>();
  let activeMultilineField: (typeof multilineMetadataFields)[number] | null = null;
  const addWebsite = (value: string) => {
    appendUniqueWebsite(parsedWebsites, value);
    if (seen.has("website")) {
      return;
    }

    seen.add("website");
    parsed.website = value.trim();
  };

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
          addWebsite(value);
          activeMultilineField = "website";
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
      if (activeMultilineField === "website") {
        addWebsite(continuationText);
        return;
      }

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
    version: parsed.version,
    author: parsed.author,
    credits: parsed.credits,
    grants: parsedGrants,
  };
};
