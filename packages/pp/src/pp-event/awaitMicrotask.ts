export const awaitMicrotask = () => new Promise<void>((resolve) => queueMicrotask(resolve));
