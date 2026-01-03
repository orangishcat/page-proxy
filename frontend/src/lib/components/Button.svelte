<script lang="ts" module>
  import type {Snippet} from 'svelte';
  import type {HTMLButtonAttributes} from 'svelte/elements';

  export type ButtonVariant = 'primary' | 'secondary' | 'outline';

  export type ButtonProps = HTMLButtonAttributes & {
    variant?: ButtonVariant;
    children?: Snippet;
  };

</script>

<script lang="ts">
  let {
    variant = 'primary',
    type,
    disabled = false,
    class: className = '',
    children,
    ...restProps
  }: ButtonProps = $props();

  const buttonType = $derived(
    type === 'submit' || type === 'reset' ? type : 'button'
  );

  const baseClasses =
    'box-border rounded-xl text-button text-gray-950 transition hover:opacity-80 active:opacity-60 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100';

  const variantClasses = {
    primary:
      'border border-primary-600 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary-600 to-primary-400 px-5 py-2',
    secondary: 'border border-secondary-500 bg-secondary-500 px-5 py-2',
    outline:
      'p-2 flex justify-center place-items-center text-gray-500 dark:text-gray-400'
  } satisfies Record<ButtonVariant, string>;
</script>

<button
  {...restProps}
  class={`${baseClasses} ${variantClasses[variant]} ${className}`}
  type={buttonType}
  disabled={disabled}
>
  {#if children}
    {@render children()}
  {:else}
    Button
  {/if}
</button>
