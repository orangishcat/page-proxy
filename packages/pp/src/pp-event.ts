export type OnElementCreatedHandler = (element: Element) => void;
export type KeyAction = "press" | "release";
export type OnKeyPressedHandler = (event: KeyboardEvent) => void;
export type OnKeyPressedOptions = {
  keyAction?: KeyAction[];
  cancel?: boolean;
};

type KeyCombo = {
  key: string | null;
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
};

type ModifierName = keyof KeyCombo["modifiers"];

const defaultCreateObserverOptions: MutationObserverInit = {
  childList: true,
  subtree: true,
};
const defaultKeyActions: KeyAction[] = ["press"];
const keyActionEventType: Record<KeyAction, "keydown" | "keyup"> = {
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

const modifierKeyToName: Record<string, ModifierName | undefined> = {
  control: "ctrl",
  shift: "shift",
  alt: "alt",
  meta: "meta",
};

const parseKeyTokens = (keys: string) => {
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

const normalizeKeyToken = (token: string) => {
  const rawToken = token.trim().toLowerCase();
  const normalizedToken = rawToken.length === 0 ? "+" : rawToken;

  if (/^f\d{1,2}$/.test(normalizedToken)) {
    return normalizedToken;
  }

  return keyAliasMap[normalizedToken] ?? normalizedToken;
};

const normalizeKeyboardEventKey = (key: string) => {
  if (key === " ") {
    return "space";
  }

  return normalizeKeyToken(key);
};

const parseKeyCombo = (keys: string): KeyCombo => {
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

const resolveKeyActions = (value: KeyAction[] | undefined): KeyAction[] => {
  const actions = value && value.length > 0 ? value : defaultKeyActions;
  actions.forEach((action) => {
    if (action !== "press" && action !== "release") {
      throw new Error(`Invalid keyAction "${String(action)}". Expected "press" or "release".`);
    }
  });

  return Array.from(new Set(actions));
};

const resolveEffectiveModifierState = (event: KeyboardEvent, normalizedEventKey: string, action: KeyAction) => {
  const includeReleasedModifier = action === "release";
  return {
    ctrl: event.ctrlKey || (includeReleasedModifier && normalizedEventKey === "control"),
    shift: event.shiftKey || (includeReleasedModifier && normalizedEventKey === "shift"),
    alt: event.altKey || (includeReleasedModifier && normalizedEventKey === "alt"),
    meta: event.metaKey || (includeReleasedModifier && normalizedEventKey === "meta"),
  };
};

const doesKeyboardEventMatchCombo = (event: KeyboardEvent, combo: KeyCombo, action: KeyAction) => {
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

const getNodeCreatedElements = (node: Node): Element[] => {
  if (node instanceof Element) {
    return [node, ...Array.from(node.querySelectorAll("*"))];
  }

  if (node instanceof DocumentFragment) {
    return Array.from(node.querySelectorAll("*"));
  }

  return [];
};

const runOnCreatedElements = (node: Node, func: OnElementCreatedHandler) => {
  getNodeCreatedElements(node).forEach(func);
};

export class ElementCreatedObserver extends MutationObserver {
  private readonly func: OnElementCreatedHandler;
  private readonly targetNode: Node;

  constructor(func: OnElementCreatedHandler, targetNode: Node) {
    super((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type !== "childList" || mutation.addedNodes.length === 0) {
          return;
        }

        mutation.addedNodes.forEach((node) => {
          runOnCreatedElements(node, func);
        });
      });
    });
    this.func = func;
    this.targetNode = targetNode;
  }

  runOnTargetNode() {
    runOnCreatedElements(this.targetNode, this.func);
  }
}

export const onElementCreated = (
  func: OnElementCreatedHandler,
  targetNode: Node = document.body ?? document.documentElement,
  observerOptions: MutationObserverInit = defaultCreateObserverOptions,
) => {
  const observer = new ElementCreatedObserver(func, targetNode);
  observer.observe(targetNode, observerOptions);
  observer.runOnTargetNode();
  return observer;
};

export const onKeyPressed = (keys: string, func: OnKeyPressedHandler, options: OnKeyPressedOptions = {}) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const combo = parseKeyCombo(keys);
  const keyActions = resolveKeyActions(options.keyAction);
  const cancel = options.cancel !== false;

  const handleKeyEvent = (event: KeyboardEvent, action: KeyAction) => {
    if (!doesKeyboardEventMatchCombo(event, combo, action)) {
      return;
    }

    if (cancel) {
      event.preventDefault();
    }

    func(event);
  };

  const handleKeyDown = (event: KeyboardEvent) => handleKeyEvent(event, "press");
  const handleKeyUp = (event: KeyboardEvent) => handleKeyEvent(event, "release");

  if (keyActions.includes("press")) {
    window.addEventListener(keyActionEventType.press, handleKeyDown);
  }

  if (keyActions.includes("release")) {
    window.addEventListener(keyActionEventType.release, handleKeyUp);
  }

  return () => {
    if (keyActions.includes("press")) {
      window.removeEventListener(keyActionEventType.press, handleKeyDown);
    }

    if (keyActions.includes("release")) {
      window.removeEventListener(keyActionEventType.release, handleKeyUp);
    }
  };
};

export const pageModificationFunctions = [
  "pa.notification",
  "pt.setItem",
  "pt.getItem",
  "pv.onElementCreated",
  "pv.onKeyPressed",
  "pn.fetch",
  "pn.invalidateCache",
  "pn.get",
  "pn.head",
  "pn.post",
  "pn.put",
  "pn.delete",
  "pn.connect",
  "pn.options",
  "pn.trace",
  "pn.patch",
  "pq.selector",
  "ps.applyStyle",
  "ps.injectCSS",
  "pq.propMatches",
  "pq.propContains",
  "pq.propExists",
  "pq.tagMatches",
  "pq.selectorMatches",
  "pq.innerTextMatches",
  "pq.bboxMatches",
  "pq.traverseParents",
];
