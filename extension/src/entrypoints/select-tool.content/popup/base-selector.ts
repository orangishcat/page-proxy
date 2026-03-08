const baseSelectorPattern = /((?:"baseSelector"|'baseSelector'|baseSelector)\s*:\s*)(["'`])((?:\\.|(?!\2)[\s\S])*?)\2/;

const decodeStringLiteral = (value: string) => {
  return value.replace(/\\([\\'"`nrt])/g, (_match, token: string) => {
    if (token === "n") {
      return "\n";
    }
    if (token === "r") {
      return "\r";
    }
    if (token === "t") {
      return "\t";
    }
    return token;
  });
};

const escapeForQuote = (value: string, quote: string) => {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replaceAll(quote, `\\${quote}`);
};

export const readBaseSelectorFromCode = (code: string): string | null => {
  const match = code.match(baseSelectorPattern);
  if (!match) {
    return null;
  }

  return decodeStringLiteral(match[3]);
};

export const replaceBaseSelectorInCode = (code: string, nextSelector: string): string | null => {
  if (!baseSelectorPattern.test(code)) {
    return null;
  }

  return code.replace(baseSelectorPattern, (_match, prefix: string, quote: string) => {
    return `${prefix}${quote}${escapeForQuote(nextSelector, quote)}${quote}`;
  });
};
