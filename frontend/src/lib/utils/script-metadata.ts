export type ScriptMetadata = {
  title: string;
  website: string;
  description: string;
};

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
  match[1]
    .split('\n')
    .map((line) => line.trim())
    .forEach((line) => {
      const metaMatch = line.match(/^\/\/\s*@([\w-]+)\s*:?\s*(.*)$/);
      if (!metaMatch) {
        return;
      }
      const [, key, value] = metaMatch;
      if (key === 'title') {
        data.title = value.trim();
      }
      if (key === 'website') {
        data.website = value.trim();
      }
      if (key === 'description') {
        data.description = value.trim();
      }
    });
  return data;
};
