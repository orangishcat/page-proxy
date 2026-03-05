export type ElementInfo = {
  tag: string;
  id: string | null;
  name: string | null;
  className: string | null;
  innerText: string | null;
  selector: string;
  attributes: Record<string, string>;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type ElementSelectionSource = "content" | "devtools";

export type ElementSelectionContext = {
  source: ElementSelectionSource;
  tabId: number | null;
  frameId: number | null;
  frameUrl: string | null;
};

export type SelectorSavePayload = {
  name: string | null;
  code: string;
  baseSelector?: string;
};

export type SelectorPopupMode = "pp-api" | "css";

export type SelectorSaveResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export type SelectorOpenResult = {
  opened: boolean;
};

export type RecordTimelineEntry = {
  id: string;
  action: string;
  detail: string;
  timestamp: number;
};

export type RecordConverterOpenPayload = {
  timeline: RecordTimelineEntry[];
  existingCode: string;
};

export type RecordConverterOpenResult = {
  opened: boolean;
  error?: string;
};

export type RecordConverterSavePayload = {
  code: string;
};

export type RecordConverterSaveResult = {
  ok: boolean;
  error?: string;
  finalCode?: string;
  renameMap?: Record<string, string>;
};

export type SelectElementAction = "click" | "copy" | "cut" | "paste" | "delete";

export type SelectElementActionResult =
  | {
      ok: true;
      html?: string;
    }
  | {
      ok: false;
      error: string;
    };

export type SelectToolMessage =
  | {
      type: 'select:toggle';
      enabled: boolean;
      clearSelection?: boolean;
    }
  | {
      type: 'select:mode';
      enabled: boolean;
    }
  | {
      type: 'select:parent';
    }
  | {
      type: "select:action";
      action: SelectElementAction;
    }
  | {
      type: 'selector:open';
      payload: ElementInfo | null;
      mode?: SelectorPopupMode;
      initialCssContent?: string;
      initialCode?: string;
    }
  | {
      type: "record:converter:open";
      payload: RecordConverterOpenPayload;
    }
  | {
      type: "record:converter:save";
      payload: RecordConverterSavePayload;
    }
  | {
      type: 'selector:save';
      payload: SelectorSavePayload;
    }
  | {
      type: 'select:hover';
      payload: ElementInfo | null;
    }
  | {
      type: 'select:selected';
      payload: ElementInfo | null;
    }
  | {
      type: "selectors:hover";
      payload: {
        selectorName: string;
        rules: string[];
      } | null;
    };
