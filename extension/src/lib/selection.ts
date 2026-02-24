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

export type SelectCopyResult =
  | {
      ok: true;
      copyId: string;
      cut: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export type SelectPasteLocation = "child" | "before" | "after";

export type SelectPasteResult =
  | {
      ok: true;
      copyId: string;
      cut: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export type SelectDeleteResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export type SelectToolMessage =
  | {
      type: 'select:toggle';
      enabled: boolean;
    }
  | {
      type: 'select:mode';
      enabled: boolean;
    }
  | {
      type: 'select:parent';
    }
  | {
      type: 'select:copy';
      payload: ElementInfo | null;
      cut: boolean;
    }
  | {
      type: "select:paste";
      payload: ElementInfo | null;
      copyId: string;
      cut: boolean;
      childPosition: number;
      pasteLocation: SelectPasteLocation;
    }
  | {
      type: "select:delete";
      payload: ElementInfo | null;
    }
  | {
      type: 'selector:open';
      payload: ElementInfo | null;
      mode?: SelectorPopupMode;
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
