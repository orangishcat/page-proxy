<script lang="ts" module>
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  export type ButtonVariant = "primary" | "secondary" | "outline";

  export type ButtonProps = HTMLButtonAttributes & {
    variant?: ButtonVariant;
    children?: Snippet;
  };
</script>

<script lang="ts">
  let {
    variant = "primary",
    type,
    disabled = false,
    class: className = "",
    children,
    ...restProps
  }: ButtonProps = $props();

  const buttonType = $derived(type === "submit" || type === "reset" ? type : "button");

  const baseClasses =
    "box-border rounded-xl text-button text-gray-950 transition hover:opacity-80 active:opacity-60 " +
    "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 " +
    "flex place-items-center justify-center";

  const variantClasses = {
    primary: "border border-primary-600 bg-radial from-primary-600 to-primary-400 px-5 py-2 text-black dark:text-white",
    secondary: "border border-secondary-500 bg-secondary-500 px-5 py-2 text-black dark:text-white",
    outline: "p-2 text-gray-500 dark:text-gray-400",
  } satisfies Record<ButtonVariant, string>;
</script>

<button {...restProps} class={`${baseClasses} ${variantClasses[variant]} ${className}`} type={buttonType} {disabled}>
  {#if children}
    {@render children()}
  {:else}
    Button
  {/if}
</button>
