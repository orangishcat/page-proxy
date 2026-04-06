export type KeyAction = "press" | "release";

export type KeyCombo = {
  key: string | null;
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
};

type ModifierName = keyof KeyCombo["modifiers"];

export type ResolvedKeyAction = {
  action: KeyAction;
  eventType: "keydown" | "keyup";
};

const defaultKeyActions: KeyAction[] = ["press"];

const keyActionEventType: Record<KeyAction, ResolvedKeyAction["eventType"]> = {
  press: "keydown",
  release: "keyup",
};

const keyAliasMap: Record<string, string> = {
  esc: "escape",
  escape: "escape",
  tab: "tab",
  caps: "capslock",
  capslock: "capslock",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  win: "meta",
  super: "meta",
  shift: "shift",
  ctrl: "control",
  control: "control",
  ctl: "control",
  alt: "alt",
  opt: "alt",
  option: "alt",
  enter: "enter",
  return: "enter",
  backspace: "backspace",
  bs: "backspace",
  delete: "delete",
  del: "delete",
  space: "space",
  spacebar: "space",
  plus: "+",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
};

export const modifierKeyToName: Record<string, ModifierName | undefined> = {
  control: "ctrl",
  shift: "shift",
  alt: "alt",
  meta: "meta",
};

export const parseKeyTokens = (keys: string) => {
  const tokens: string[] = [];
  let current = "";

  for (let index = 0; index < keys.length; index += 1) {
    const char = keys[index];
    if (char !== "+") {
      current += char;
      continue;
    }

    if (current.length === 0) {
      tokens.push("+");
      continue;
    }

    tokens.push(current);
    current = "";
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
};

export const normalizeKeyToken = (token: string) => {
  const rawToken = token.trim().toLowerCase();
  const normalizedToken = rawToken.length === 0 ? "+" : rawToken;

  if (/^f\d{1,2}$/.test(normalizedToken)) {
    return normalizedToken;
  }

  return keyAliasMap[normalizedToken] ?? normalizedToken;
};

export const normalizeKeyboardEventKey = (key: string) => {
  if (key === " ") {
    return "space";
  }

  return normalizeKeyToken(key);
};

export const parseKeyCombo = (keys: string): KeyCombo => {
  if (keys.trim().length === 0) {
    throw new Error("onKeyPressed keys must not be empty.");
  }

  const combo: KeyCombo = {
    key: null,
    modifiers: {
      ctrl: false,
      shift: false,
      alt: false,
      meta: false,
    },
  };

  const tokens = parseKeyTokens(keys);
  if (tokens.length === 0) {
    throw new Error("onKeyPressed keys must not be empty.");
  }

  tokens.forEach((token) => {
    const normalizedToken = normalizeKeyToken(token);
    const modifierName = modifierKeyToName[normalizedToken];

    if (modifierName) {
      combo.modifiers[modifierName] = true;
      return;
    }

    if (combo.key !== null) {
      throw new Error(`onKeyPressed only supports one non-modifier key. Received "${keys}".`);
    }

    combo.key = normalizedToken;
  });

  if (
    combo.key === null &&
    !combo.modifiers.ctrl &&
    !combo.modifiers.shift &&
    !combo.modifiers.alt &&
    !combo.modifiers.meta
  ) {
    throw new Error("onKeyPressed keys must include at least one key.");
  }

  return combo;
};

export const resolveKeyActions = (value: KeyAction[] | undefined): ResolvedKeyAction[] => {
  const actions = value && value.length > 0 ? value : defaultKeyActions;
  actions.forEach((action) => {
    if (action !== "press" && action !== "release") {
      throw new Error(`Invalid keyAction "${String(action)}". Expected "press" or "release".`);
    }
  });

  return Array.from(new Set(actions)).map((action) => ({
    action,
    eventType: keyActionEventType[action],
  }));
};

export const resolveEffectiveModifierState = (event: KeyboardEvent, normalizedEventKey: string, action: KeyAction) => {
  const includeReleasedModifier = action === "release";
  return {
    ctrl: event.ctrlKey || (includeReleasedModifier && normalizedEventKey === "control"),
    shift: event.shiftKey || (includeReleasedModifier && normalizedEventKey === "shift"),
    alt: event.altKey || (includeReleasedModifier && normalizedEventKey === "alt"),
    meta: event.metaKey || (includeReleasedModifier && normalizedEventKey === "meta"),
  };
};

export const doesKeyboardEventMatchCombo = (event: KeyboardEvent, combo: KeyCombo, action: KeyAction) => {
  const normalizedEventKey = normalizeKeyboardEventKey(event.key);

  if (combo.key === null) {
    const modifierName = modifierKeyToName[normalizedEventKey];
    if (!modifierName || combo.modifiers[modifierName] !== true) {
      return false;
    }
  } else if (normalizedEventKey !== combo.key) {
    return false;
  }

  const modifierState = resolveEffectiveModifierState(event, normalizedEventKey, action);
  return (
    modifierState.ctrl === combo.modifiers.ctrl &&
    modifierState.shift === combo.modifiers.shift &&
    modifierState.alt === combo.modifiers.alt &&
    modifierState.meta === combo.modifiers.meta
  );
};

export const runKeyHandler = (
  event: KeyboardEvent,
  combo: KeyCombo,
  action: KeyAction,
  func: (event: KeyboardEvent) => void,
  cancel: boolean | undefined,
) => {
  if (!doesKeyboardEventMatchCombo(event, combo, action)) {
    return;
  }

  if (cancel) {
    event.preventDefault();
  }

  func(event);
};

type SyntheticKeyEventPayload = {
  key: string;
  code: string;
  keyCode: number;
  which: number;
};

const keyTokenEventPayloadMap: Record<string, SyntheticKeyEventPayload> = {
  escape: { key: "Escape", code: "Escape", keyCode: 27, which: 27 },
  tab: { key: "Tab", code: "Tab", keyCode: 9, which: 9 },
  enter: { key: "Enter", code: "Enter", keyCode: 13, which: 13 },
  backspace: { key: "Backspace", code: "Backspace", keyCode: 8, which: 8 },
  delete: { key: "Delete", code: "Delete", keyCode: 46, which: 46 },
  space: { key: " ", code: "Space", keyCode: 32, which: 32 },
  arrowup: { key: "ArrowUp", code: "ArrowUp", keyCode: 38, which: 38 },
  arrowdown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40 },
  arrowleft: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37, which: 37 },
  arrowright: { key: "ArrowRight", code: "ArrowRight", keyCode: 39, which: 39 },
  control: { key: "Control", code: "ControlLeft", keyCode: 17, which: 17 },
  shift: { key: "Shift", code: "ShiftLeft", keyCode: 16, which: 16 },
  alt: { key: "Alt", code: "AltLeft", keyCode: 18, which: 18 },
  meta: { key: "Meta", code: "MetaLeft", keyCode: 91, which: 91 },
};

const toSyntheticKeyToken = (keys: string, combo: KeyCombo) => {
  const normalizedTokens = parseKeyTokens(keys).map(normalizeKeyToken);
  let keyFromInput: string | null = null;
  for (let index = normalizedTokens.length - 1; index >= 0; index -= 1) {
    const token = normalizedTokens[index];
    if (!modifierKeyToName[token]) {
      keyFromInput = token;
      break;
    }
  }

  if (keyFromInput === null) {
    keyFromInput = normalizedTokens.length > 0 ? normalizedTokens[normalizedTokens.length - 1] : combo.key;
  }

  if (keyFromInput === null) {
    keyFromInput = "meta";
  }

  return keyFromInput;
};

export const createSyntheticKeyboardEvent = (keys: string, combo: KeyCombo, keyAction: ResolvedKeyAction) =>
  (() => {
    const keyToken = toSyntheticKeyToken(keys, combo);
    const mappedPayload = keyTokenEventPayloadMap[keyToken];
    const fKeyMatch = /^f(\d{1,2})$/.exec(keyToken);
    const functionKeyNumber = fKeyMatch ? Number.parseInt(fKeyMatch[1], 10) : null;
    const functionKeyPayload =
      functionKeyNumber && functionKeyNumber >= 1 && functionKeyNumber <= 24
        ? {
            key: `F${functionKeyNumber}`,
            code: `F${functionKeyNumber}`,
            keyCode: 111 + functionKeyNumber,
            which: 111 + functionKeyNumber,
          }
        : null;

    const alphanumericPayload =
      keyToken.length === 1 && /^[a-z0-9]$/.test(keyToken)
        ? {
            key: keyToken,
            code: /^[a-z]$/.test(keyToken) ? `Key${keyToken.toUpperCase()}` : `Digit${keyToken}`,
            keyCode: keyToken.toUpperCase().charCodeAt(0),
            which: keyToken.toUpperCase().charCodeAt(0),
          }
        : null;

    const symbolPayload =
      keyToken === "+"
        ? {
            key: "+",
            code: "Equal",
            keyCode: 187,
            which: 187,
          }
        : null;

    const payload =
      mappedPayload ??
      functionKeyPayload ??
      alphanumericPayload ??
      symbolPayload ?? {
        key: keyToken,
        code: keyToken,
        keyCode: 0,
        which: 0,
      };

    const event = new KeyboardEvent(
      keyAction.eventType,
      {
        key: payload.key,
        code: payload.code,
        keyCode: payload.keyCode,
        which: payload.which,
        ctrlKey: combo.modifiers.ctrl,
        shiftKey: combo.modifiers.shift,
        altKey: combo.modifiers.alt,
        metaKey: combo.modifiers.meta,
        bubbles: true,
        cancelable: true,
        composed: true,
      } as KeyboardEventInit & { keyCode: number; which: number },
    );

    return event;
  })();
