import { ElementCreatedObserver } from "./ElementCreatedObserver";
import type { OnElementCreatedHandler } from "./ElementCreatedObserver";

const defaultCreateObserverOptions: MutationObserverInit = {
  childList: true,
  subtree: true,
};

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
