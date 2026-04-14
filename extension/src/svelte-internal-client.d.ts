declare module "svelte/internal/client" {
  export const proxy: <T extends object>(value: T) => T;
  export const snapshot: <T>(value: T) => T;
}
