export type OnElementCreatedHandler = (element: Element) => void;

const defaultCreateObserverOptions: MutationObserverInit = {
  childList: true,
  subtree: true,
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
        if (mutation.type !== "childList" || mutation.addedNodes.length === 0) return;

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
  return observer;
};
