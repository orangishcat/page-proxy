export type TraverseParentsOptions<T = HTMLElement> = {
  postMap?: (element: HTMLElement) => T;
};

export const traverseParents = <T = HTMLElement>(
  el: Element,
  matcher: (element: HTMLElement) => boolean,
  options: TraverseParentsOptions<T> = {},
): T | null => {
  const postMap: (element: HTMLElement) => T = options.postMap ?? ((element: HTMLElement) => element as T);
  let current = el.parentElement;

  while (current) {
    if (current instanceof HTMLElement && matcher(current)) {
      return postMap(current);
    }
    current = current.parentElement;
  }

  return null;
};
