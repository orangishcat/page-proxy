export const hoverClass = "pp-hover";
export const selectedClass = "pp-selected";
export const hoveredPreviewClass = "pp-hovered";
export const noSelectClass = "pp-no-select-tool";
export const selectorsHoverExclusionClass = "pp-no-select-tool";
export const contentUiRootClass = "pp-content-ui-root";
export const styleId = "page-proxy-selection-styles";
export const selectorLabelId = "page-proxy-selector-label";

export const selectionStyles = `
.pp-hover { outline: 2px solid #86d24b !important; outline-offset: -1px !important; }
.pp-selected { outline: 2px solid #bb9348 !important; outline-offset: -1px !important; }
.pp-hovered { outline: 2px solid #86d24b !important; outline-offset: -1px !important; }
.pp-selected-label {
  position: fixed;
  z-index: 2147483646;
  background: #282824;
  color: #f2f0ea;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #3F403A;
  box-shadow: 0 4px 8px rgba(0,0,0,0.25);
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (prefers-color-scheme: light) {
  .pp-selected-label { background: #f7f4ee; color: #1f1d18; border-color: #d9d2c2; }
}
`;
