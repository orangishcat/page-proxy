declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svelte' {
  const component: import('svelte').Component;
  export default component;
}
