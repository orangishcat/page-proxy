import { parseKeyCombo, resolveKeyActions, createSyntheticKeyboardEvent } from "./_key-helpers";
import type { OnKeyPressedOptions } from "./onKeyPressed";

export const pressKey = (keys: string, options: OnKeyPressedOptions = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  const combo = parseKeyCombo(keys);
  const keyActions = resolveKeyActions(options.keyAction);
  const target: EventTarget = document.activeElement ?? document;

  keyActions.forEach((keyAction) => {
    const event = createSyntheticKeyboardEvent(keys, combo, keyAction);
    if (options.cancel) {
      event.preventDefault();
    }
    target.dispatchEvent(event);
  });
};
