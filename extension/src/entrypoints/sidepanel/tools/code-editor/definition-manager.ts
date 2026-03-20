export const defineBlockStart = "// ==Selectors==";
export const defineBlockEnd = "// ==/Selectors==";

export const getDefinitionBlock = (content: string): string => {
  const lines = content.split("\n");
  const startIndex = lines.findIndex((line) => line.trim() === defineBlockStart);
  const endIndex = lines.findIndex((line) => line.trim() === defineBlockEnd);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Missing "${defineBlockStart}" block.`);
  }

  if (endIndex <= startIndex) {
    throw new Error(`Invalid "${defineBlockStart}" block ordering.`);
  }

  return lines.slice(startIndex + 1, endIndex).join("\n");
};

export const insertDefinitionLines = (
  content: string,
  linesToInsert: string[],
  blockEnd: string,
): string => {
  const lines = content.split("\n");
  const endIndex = lines.findIndex((line) => line.trim() === blockEnd);

  if (endIndex === -1) {
    return content;
  }

  lines.splice(endIndex, 0, ...linesToInsert, "");
  return lines.join("\n");
};
