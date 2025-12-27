<script lang="ts" context="module">
  export type ButtonVariant = 'primary' | 'secondary';
</script>

<script lang="ts">
  export let variant: ButtonVariant = 'primary';
  export let type: 'button' | 'submit' | 'reset' = 'button';

  const baseClasses =
    'interactive-hover box-border rounded-2xl px-8 py-3 text-button text-gray-100 hover:brightness-110 active:brightness-95';

  const variantClasses = {
    primary: 'border border-accent-500 bg-gradient-to-br from-primary-400 to-primary-500',
    secondary: 'border border-accent-600 bg-primary-600'
  } satisfies Record<ButtonVariant, string>;
</script>

<button class={`${baseClasses} ${variantClasses[variant]}`} type={type}>
  <slot>Button</slot>
</button>
