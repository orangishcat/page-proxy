<script lang="ts">
  import { ChevronDown } from 'lucide-svelte';
  import { DropdownMenu } from 'bits-ui';

  export let initialOpen = false;
  export let label = 'Dropdown';
  export let options = ['Option 1', 'Option 2', 'Option 3'];

  let open = initialOpen;

  const triggerClasses =
    'text-body flex min-w-64 items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-100 pl-4 pr-3 py-1.5 text-left text-gray-700 shadow-lg hover:bg-gray-200 active:bg-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:active:bg-gray-500';

  const contentClasses =
    'grid min-w-64 mt-1 gap-1.5 rounded-lg border border-gray-200 bg-gray-100 p-1 text-gray-700 shadow-xl dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

  const itemClasses =
    'text-body cursor-pointer rounded-lg px-3 py-1.5 text-left hover:bg-gray-200 active:bg-gray-300 dark:hover:bg-gray-600 dark:active:bg-gray-500';
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger class={triggerClasses}>
    <span>{label}</span>
    <ChevronDown
      class={`h-4 w-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    />
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content class={contentClasses} preventScroll={false}>
      {#if $$slots.default}
        <slot />
      {:else}
        {#each options as option (option)}
          <DropdownMenu.Item class={itemClasses}>{option}</DropdownMenu.Item>
        {/each}
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
