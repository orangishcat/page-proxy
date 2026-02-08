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

export type SelectorRuleFilters = {
  contains: Record<string, string>;
  matches: Record<string, string>;
  keyOnly: string[];
};

export type SelectorPropertyValues = Record<string, string>;

export type SelectorSavePayload = {
  name: string | null;
  selector: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  properties: SelectorRuleFilters | SelectorPropertyValues;
  code?: string;
};

export type SelectToolMessage =
  | {
      type: 'select:toggle';
      enabled: boolean;
    }
  | {
      type: 'select:parent';
    }
  | {
      type: 'selector:open';
      payload: ElementInfo | null;
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
    };
