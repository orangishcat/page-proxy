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
    'interactive-hover text-body rounded-lg px-2 py-2 text-left text-gray-100 hover:bg-gray-950/20 active:bg-gray-950/40';
</script>

<div
  class="box-border min-w-72 max-w-full rounded-2xl border border-gray-950 bg-gray-800 px-5 pb-4 pt-3 text-gray-100"
>
  <button
    class="interactive-hover text-body flex w-full items-center justify-between gap-4 rounded-xl px-2 py-2 text-left active:bg-gray-950/40"
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
    <div class="mt-2 grid gap-2 border-t border-secondary-700 pt-3">
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
