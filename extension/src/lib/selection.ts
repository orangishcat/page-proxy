export type ElementInfo = {
  tag: string;
  id: string | null;
  name: string | null;
  className: string | null;
  selector: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type SelectToolMessage =
  | {
      type: 'select:toggle';
      enabled: boolean;
    }
  | {
      type: 'select:hover';
      payload: ElementInfo | null;
    }
  | {
      type: 'select:selected';
      payload: ElementInfo | null;
    };
