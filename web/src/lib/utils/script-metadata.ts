export type ScriptMetadata = {
  title: string;
  website: string;
  description: string;
};

const metadataFieldLinePattern = /^\s*\/\/\s*@[\w-]+/;
const metadataCommentLinePattern = /^(\s*\/\/\s?)(.*)$/;

export const parseScriptMetadata = (content: string): ScriptMetadata | null => {
  const match = content.match(
    /\/\/\s*==\s*Page\s*Proxy\s*==([\s\S]*?)\/\/\s*==\s*\/\s*Page\s*Proxy\s*==/
  );
  if (!match) {
    return null;
  }
  const data: ScriptMetadata = {
    title: '',
    website: '',
    description: ''
  };
  let activeMultilineField: "description" | null = null;
  match[1]
    .split('\n')
    .map((line) => line.trim())
    .forEach((line) => {
      const metaMatch = line.match(/^\/\/\s*@([\w-]+)\s*:?\s*(.*)$/);
      if (metaMatch) {
        const [, key, value] = metaMatch;
        activeMultilineField = key === 'description' ? "description" : null;
        if (key === 'title') {
          data.title = value.trim();
        }
        if (key === 'website') {
          data.website = value.trim();
        }
        if (key === 'description') {
          data.description = value.trim();
        }
        return;
      }

      if (metadataFieldLinePattern.test(line)) {
        activeMultilineField = null;
        return;
      }

      if (activeMultilineField !== "description") {
        return;
      }

      const continuationMatch = line.match(metadataCommentLinePattern);
      if (!continuationMatch) {
        activeMultilineField = null;
        return;
      }

      const continuationValue = continuationMatch[2]?.trim() ?? "";
      if (!continuationValue) {
        return;
      }

      data.description = data.description
        ? `${data.description}\n${continuationValue}`
        : continuationValue;
    });
  return data;
};
