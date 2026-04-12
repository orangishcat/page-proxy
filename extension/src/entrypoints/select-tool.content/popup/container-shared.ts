export const POPUP_BASE_FONT_SIZE_PX = 16;

const popupDarkModeStyle = "color-scheme: dark;";
const popupFontSizeStyle = `font-size: ${POPUP_BASE_FONT_SIZE_PX}px !important;`;
const popupEmSizingStyleVars =
  "--spacing: 0.25em; --text-xs: 0.75em; --text-sm: 0.875em; --text-base: 1em; --text-lg: 1.25em; --radius-sm: 0.25em; --radius-md: 0.375em; --radius-lg: 0.5em; --radius-xl: 0.75em; --radius-2xl: 1em; --radius-3xl: 1.5em;";
const popupContainerSizeVars =
  "--container-3xs: 16em; --container-2xs: 18em; --container-xs: 20em; --container-sm: 24em; --container-md: 28em; --container-lg: 32em; --container-xl: 36em; --container-2xl: 42em; --container-3xl: 48em; --container-4xl: 56em; --container-5xl: 64em;";
export const POPUP_SHARED_STYLE = `${popupDarkModeStyle} ${popupFontSizeStyle} ${popupEmSizingStyleVars} ${popupContainerSizeVars}`;
export const POPUP_SHARED_CLASS =
  "pp-no-select-tool pp-content-ui-root font-sans text-sm border border-gray-700 bg-[#24231f]";

const keyboardOwnershipEvents = ["keydown", "keyup", "keypress"] as const;

const stopKeyboardPropagation = (event: KeyboardEvent) => {
  event.stopPropagation();
};

export const attachPopupKeyboardOwnership = (element: HTMLElement | null | undefined) => {
  if (!element) {
    return () => {};
  }

  keyboardOwnershipEvents.forEach((eventName) => {
    element.addEventListener(eventName, stopKeyboardPropagation);
  });

  return () => {
    keyboardOwnershipEvents.forEach((eventName) => {
      element.removeEventListener(eventName, stopKeyboardPropagation);
    });
  };
};
