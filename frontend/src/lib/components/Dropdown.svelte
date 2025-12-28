<script lang="ts">
  import { ChevronDown, ChevronUp } from 'lucide-svelte';

  export let initialOpen = false;
  export let label = 'Dropdown';
  export let options = ['Option 1', 'Option 2', 'Option 3'];

  let isOpen = initialOpen;

  const toggle = () => {
    isOpen = !isOpen;
  };

  const itemClasses =
    'text-body rounded-lg px-2 py-2 text-left text-gray-950 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-100 dark:hover:bg-gray-950/20 dark:active:bg-gray-950/40';
</script>

<div
  class="box-border min-w-72 max-w-full rounded-2xl border border-gray-200 bg-white px-5 pb-4 pt-3 text-gray-950 dark:border-gray-950 dark:bg-gray-800 dark:text-gray-100"
>
  <button
    class="text-body flex w-full items-center justify-between gap-4 rounded-xl px-2 py-2 text-left hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-950/20 dark:active:bg-gray-950/40"
    type="button"
    on:click={toggle}
  >
    <span>{label}</span>
    {#if isOpen}
      <ChevronUp class="h-4 w-4" />
    {:else}
      <ChevronDown class="h-4 w-4" />
    {/if}
  </button>

  {#if isOpen}
    <div class="mt-2 grid gap-2 border-t border-secondary-500 pt-3 dark:border-secondary-700">
      {#if $$slots.default}
        <slot />
      {:else}
        {#each options as option (option)}
          <button class={itemClasses} type="button">
            {option}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
