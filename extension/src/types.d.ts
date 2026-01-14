declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svelte' {
  const component: import('svelte').Component;
  export default component;
}

declare module '@endo/lockdown' {
  export type LockdownOptions = {
    errorTaming?: 'safe' | 'unsafe' | 'unsafe-guards';
    stackFiltering?: 'concise' | 'verbose';
    overrideTaming?: 'severe' | 'moderate' | 'min';
  };

  export const lockdown: (options?: LockdownOptions) => void;
}

interface GlobalThis {
  Compartment?: new (endowments?: Record<string, unknown>) => {
    evaluate: (code: string) => unknown;
    globalThis: unknown;
  };
  harden?: <T>(value: T) => T;
}
