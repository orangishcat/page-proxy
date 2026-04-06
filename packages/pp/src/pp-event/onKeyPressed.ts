import { parseKeyCombo, resolveKeyActions, runKeyHandler } from "./_key-helpers";
import type { KeyAction } from "./_key-helpers";

export type { KeyAction };
export type OnKeyPressedOptions = {
  keyAction?: KeyAction[];
  cancel?: boolean;
};

export const onKeyPressed = (keys: string, func: (event: KeyboardEvent) => void, options: OnKeyPressedOptions = {}) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const combo = parseKeyCombo(keys);
  const keyActions = resolveKeyActions(options.keyAction);
  const pressAction = keyActions.find((entry) => entry.action === "press");
  const releaseAction = keyActions.find((entry) => entry.action === "release");

  const handleKeyEvent = (event: KeyboardEvent, action: KeyAction) =>
    runKeyHandler(event, combo, action, func, options.cancel);

  const handleKeyPress = (event: KeyboardEvent) => handleKeyEvent(event, "press");
  const handleKeyUp = (event: KeyboardEvent) => handleKeyEvent(event, "release");

  if (pressAction) {
    window.addEventListener(pressAction.eventType, handleKeyPress);
  }

  if (releaseAction) {
    window.addEventListener(releaseAction.eventType, handleKeyUp);
  }

  return () => {
    if (pressAction) {
      window.removeEventListener(pressAction.eventType, handleKeyPress);
    }

    if (releaseAction) {
      window.removeEventListener(releaseAction.eventType, handleKeyUp);
    }
  };
};
