export type OnElementCreatedHandler = (element: Element) => void;

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

export class ElementCreatedObserver {
  private readonly func: OnElementCreatedHandler;
  private readonly targetNode: Node;
  private readonly observer: MutationObserver;

  constructor(func: OnElementCreatedHandler, targetNode: Node) {
    this.func = func;
    this.targetNode = targetNode;
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type !== "childList" || mutation.addedNodes.length === 0) {
          return;
        }

        mutation.addedNodes.forEach((node) => {
          runOnCreatedElements(node, func);
        });
      });
    });
  }

  observe(target: Node, options?: MutationObserverInit) {
    this.observer.observe(target, options);
  }

  disconnect() {
    this.observer.disconnect();
  }

  takeRecords() {
    return this.observer.takeRecords();
  }

  runOnTargetNode() {
    runOnCreatedElements(this.targetNode, this.func);
  }
}
