import {EditorState, type Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {javascript} from '@codemirror/lang-javascript';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {classHighlighter} from '@lezer/highlight';
import {tags as t} from '@lezer/highlight';

export const codeEditorTheme = EditorView.theme({
  '&': {
    color: '#5c6e74',
    backgroundColor: '#282824',
    fontSize: '0.8125rem',
    fontFamily: "JetBrains Mono, Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace",
    lineHeight: '1.5',
    textShadow: 'none'
  },
  '.cm-content': {
    caretColor: '#5c6e74'
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: '#b3d4fc'
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: '#b3d4fc'
  },
  '.cm-cursor': {
    borderLeftColor: '#5c6e74'
  },
  '.cm-gutters': {
    backgroundColor: '#282824',
    color: '#5c6e74',
    border: 'none'
  }
});

export const codeEditorHighlightStyle = HighlightStyle.define([
  {tag: t.comment, color: '#93a1a1'},
  {tag: t.punctuation, color: '#999999'},
  {
    tag: [t.propertyName, t.tagName, t.bool, t.number, t.constant(t.name), t.constant(t.variableName), t.deleted],
    color: '#990055'
  },
  {tag: [t.attributeName, t.string, t.character, t.standard(t.name), t.inserted], color: '#669900'},
  {tag: [t.operator, t.url], color: '#a67f59'},
  {
    tag: [t.keyword, t.attributeValue, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword],
    color: '#0077aa'
  },
  {tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#dd4a68'},
  {tag: [t.regexp, t.variableName, t.atom], color: '#ee9900'},
  {tag: t.strong, fontWeight: '700'},
  {tag: t.emphasis, fontStyle: 'italic'}
]);

export const buildCodeEditorExtensions = (): Extension[] => [
  javascript({typescript: false}),
  codeEditorTheme,
  syntaxHighlighting(codeEditorHighlightStyle, {fallback: true}),
  syntaxHighlighting(classHighlighter),
  EditorView.lineWrapping
];

export const createCodeEditorView = (
  parent: HTMLElement,
  doc: string,
  extensions: Extension[] = []
) => {
  const state = EditorState.create({
    doc,
    extensions: [...buildCodeEditorExtensions(), ...extensions]
  });

  return new EditorView({
    state,
    parent
  });
};
