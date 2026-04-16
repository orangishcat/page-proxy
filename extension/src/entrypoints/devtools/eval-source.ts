const leadingTriviaPattern = /^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*/;

const stripDefaultExport = (source: string) => {
  const leadingTrivia = source.match(leadingTriviaPattern)?.[0] ?? "";
  const body = source.slice(leadingTrivia.length);

  if (!body.startsWith("export default ")) {
    return source;
  }

  return `${leadingTrivia}${body.slice("export default ".length)}`;
};

export const buildSelectionEvalSource = (source: string, selectParent: boolean) =>
  `(${stripDefaultExport(source)})(${JSON.stringify(selectParent)})`;
