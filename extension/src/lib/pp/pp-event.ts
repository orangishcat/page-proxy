export type OnElementCreatedHandler = (element: Element) => void;

const defaultOnElementCreatedObserverOptions: MutationObserverInit = {
  childList: true,
  subtree: true,
};

const getCreatedElementsFromNode = (node: Node): Element[] => {
  if (node instanceof Element) {
    return [node, ...Array.from(node.querySelectorAll("*"))];
  }

  if (node instanceof DocumentFragment) {
    return Array.from(node.querySelectorAll("*"));
  }

  return [];
};

export const onElementCreated = (
  func: OnElementCreatedHandler,
  targetNode: Node = document.body ?? document.documentElement,
  observerOptions: MutationObserverInit = defaultOnElementCreatedObserverOptions,
) => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type !== "childList" || mutation.addedNodes.length === 0) {
        return;
      }

      mutation.addedNodes.forEach((node) => {
        getCreatedElementsFromNode(node).forEach((element) => {
          func(element);
        });
      });
    });
  });

  observer.observe(targetNode, observerOptions);
  return observer;
};
