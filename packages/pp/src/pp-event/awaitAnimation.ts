export const awaitAnimation = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
