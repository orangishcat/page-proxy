export const POPUP_BASE_FONT_SIZE_PX = 16;

export const POPUP_DARK_MODE_STYLE = "color-scheme: dark;";
export const POPUP_FONT_SIZE_STYLE = `font-size: ${POPUP_BASE_FONT_SIZE_PX}px !important;`;
export const POPUP_EM_SIZING_STYLE_VARS =
  "--spacing: 0.25em; --text-xs: 0.75em; --text-sm: 0.875em; --text-base: 1em; --text-lg: 1.25em; --radius-sm: 0.25em; --radius-md: 0.375em; --radius-lg: 0.5em; --radius-xl: 0.75em; --radius-2xl: 1em; --radius-3xl: 1.5em;";

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
