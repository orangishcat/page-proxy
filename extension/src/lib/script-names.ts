export const defaultBlankScriptTitle = "Page Proxy";

const normalizeScriptName = (scriptName: string) => scriptName.trim();

export const buildAutoNumberedScriptName = (
  baseScriptName: string,
  existingScriptNames: Iterable<string>,
): string => {
  const normalizedBaseScriptName = normalizeScriptName(baseScriptName);
  if (!normalizedBaseScriptName) {
    return "";
  }

  const normalizedExistingNames = new Set(
    Array.from(existingScriptNames)
      .map(normalizeScriptName)
      .filter((scriptName) => scriptName.length > 0),
  );

  if (!normalizedExistingNames.has(normalizedBaseScriptName)) {
    return normalizedBaseScriptName;
  }

  let suffix = 2;
  while (normalizedExistingNames.has(`${normalizedBaseScriptName} ${suffix}`)) {
    suffix += 1;
  }

  return `${normalizedBaseScriptName} ${suffix}`;
};

export const matchesScriptName = (left: string, right: string) =>
  normalizeScriptName(left) === normalizeScriptName(right);
