<script lang="ts" context="module">
  export type ButtonVariant = 'primary' | 'secondary' | 'accent';
</script>

<script lang="ts">
  export let variant: ButtonVariant = 'primary';
  export let type: 'button' | 'submit' | 'reset' = 'button';

  const baseClasses =
    'box-border rounded-xl px-5 py-2 text-button text-gray-950 hover:opacity-80 active:opacity-60 dark:text-gray-100';

  const variantClasses = {
    primary:
      'border border-accent-500 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary-600 to-primary-400',
    secondary: 'border border-accent-600 bg-primary-600',
    accent:
      'bg-transparent text-gray-950 p-2 flex justify-center hover:bg-gray-300 hover:opacity-100 active:opacity-100 dark:text-gray-100 dark:hover:bg-gray-700'
  } satisfies Record<ButtonVariant, string>;
</script>

<button class={`${baseClasses} ${variantClasses[variant]} ${$$props.class}`} type={type}>
  <slot>Button</slot>
</button>
