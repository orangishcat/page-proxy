import * as monaco from "monaco-editor/editor/editor.api";

export const pageProxyMonacoThemeName = "page-proxy-dark";

let themeDefined = false;

export const ensureCodeEditorTheme = () => {
  if (themeDefined) {
    return;
  }

  const themeData = {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "93a1a1" },
      { token: "delimiter", foreground: "999999" },
      { token: "number", foreground: "ee9900" },
      { token: "string", foreground: "669900" },
      { token: "keyword", foreground: "ff8f3f" },
      { token: "operator", foreground: "a67f59" },
      { token: "type.identifier", foreground: "59C2FF" },
      { token: "function", foreground: "FCB253" },
      { token: "entity.name.function", foreground: "FCB253" },
      { token: "support.function", foreground: "FCB253" },
      { token: "identifier.function", foreground: "FCB253" },
      { token: "entity.name.type", foreground: "59C2FF" },
      { token: "identifier", foreground: "efe2d4" },
      { token: "delimiter.bracket", foreground: "999999" },
    ],
    semanticTokenColors: {
      class: "#59C2FF",
      interface: "#59C2FF",
      function: "#FCB253",
      method: "#FCB253",
    },
    colors: {
      "editor.background": "#282824",
      "editor.foreground": "#e7e8ea",
      "editorLineNumber.foreground": "#5c6e74",
      "editorLineNumber.activeForeground": "#e7e8ea",
      "editorCursor.foreground": "#e7e8ea",
      "editor.selectionBackground": "#b3d4fc55",
      "editor.inactiveSelectionBackground": "#b3d4fc33",
      editorLineHighlightBackground: "#00000000",
      "editorGutter.background": "#282824",
      "editorSuggestWidget.background": "#222121",
      "editorSuggestWidget.border": "#3f403a",
      "editorSuggestWidget.foreground": "#f2f3f2",
      "editorHoverWidget.background": "#222121",
      "editorHoverWidget.border": "#3f403a",
      "editorHoverWidget.foreground": "#f2f3f2",
      "editorHoverWidget.highlightForeground": "#FCB253",
      "textPreformat.foreground": "#f2f3f2",
      "textLink.foreground": "#59C2FF",
    },
  };

  monaco.editor.defineTheme(pageProxyMonacoThemeName, themeData as monaco.editor.IStandaloneThemeData);
  themeDefined = true;
};
