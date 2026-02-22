<script lang="ts">
  import type { Snippet } from "svelte";

  type BannerVariant = "danger" | "warning" | "caution" | "info" | "success" | "error";

  const variantClasses: Record<
    BannerVariant,
    {
      container: string;
      dismissButton: string;
    }
  > = {
    danger: {
      container: "bg-red-700 text-red-100",
      dismissButton: "border-red-200 text-red-100 hover:bg-red-800",
    },
    warning: {
      container: "bg-[#3d341d] text-[#f4de9e]",
      dismissButton: "border-[#8f7a3c] text-[#f4de9e] hover:bg-[#5c4f28]",
    },
    caution: {
      container: "bg-[#4a2a0f] text-[#ffd8b0]",
      dismissButton: "border-[#8f5f31] text-[#ffd8b0] hover:bg-[#5f3918]",
    },
    info: {
      container: "bg-[#1e2f46] text-[#d4e9ff]",
      dismissButton: "border-[#4c6f98] text-[#d4e9ff] hover:bg-[#27405f]",
    },
    success: {
      container: "bg-[#1f3a22] text-[#b8f3bf]",
      dismissButton: "border-[#58a66b] text-[#b8f3bf] hover:bg-[#2b5a33]",
    },
    error: {
      container: "bg-[#3b1d1d] text-[#f5b1b1]",
      dismissButton: "border-current text-current hover:bg-black/10",
    },
  };

  let {
    children,
    class: className = "",
    dismissButtonClass = "",
    dismissAriaLabel = "Dismiss banner",
    dismissLabel = "Dismiss",
    onDismiss,
    showDismiss = true,
    variant = "info",
  }: {
    children?: Snippet;
    class?: string;
    dismissButtonClass?: string;
    dismissAriaLabel?: string;
    dismissLabel?: string;
    onDismiss?: (() => void) | undefined;
    showDismiss?: boolean;
    variant?: BannerVariant;
  } = $props();
</script>

<div class={`flex w-full max-w-none shrink-0 items-center gap-2 px-4 py-2 text-caption ${variantClasses[variant].container} ${className}`}>
  <span class="flex w-full flex-1 flex-wrap items-center gap-1">
    {@render children?.()}
  </span>

  {#if showDismiss}
    <button
      type="button"
      class={`rounded border px-2 py-0.5 text-caption ${variantClasses[variant].dismissButton} ${dismissButtonClass}`}
      aria-label={dismissAriaLabel}
      onclick={() => onDismiss?.()}
    >
      {dismissLabel}
    </button>
  {/if}
</div>
