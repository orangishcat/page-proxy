<svelte:head>
  <title>Components</title>
</svelte:head>

<script lang="ts">
  import type {ButtonVariant} from '$lib/components/Button.svelte';
  import Button from '$lib/components/Button.svelte';
  import Dropdown from '$lib/components/Dropdown.svelte';
  import type {NavbarVariant} from '$lib/components/Navbar.svelte';
  import Navbar from '$lib/components/Navbar.svelte';
  import GridItem from '$lib/components/GridItem.svelte';
  import AccountWidget from '$lib/components/AccountWidget.svelte';

  const entries: Array<
    | { name: string; type: 'button'; variant: ButtonVariant; label: string }
    | { name: string; type: 'dropdown'; label: string; initialOpen: boolean }
    | { name: string; type: 'component'; component: typeof GridItem }
  > = [
    {name: 'Button / Primary', type: 'button', variant: 'primary', label: 'Primary Button'},
    {name: 'Button / Secondary', type: 'button', variant: 'secondary', label: 'Secondary Button'},
    {name: 'Dropdown', type: 'dropdown', label: 'Dropdown', initialOpen: false},
    {name: 'Grid item', type: 'component', component: GridItem}
  ];

  const widgets: Array<{ name: string; component: typeof AccountWidget }> = [
    {name: 'Account', component: AccountWidget}
  ];

  const navbars: Array<{ name: string; variant: NavbarVariant }> = [
    {name: 'Navbar / Other', variant: 'other'},
    {name: 'Navbar / App', variant: 'app'},
    {name: 'Navbar / Dashboard', variant: 'dashboard'}
  ];

  const dropdownOptionClasses =
    'interactive-hover text-body rounded-lg px-2 py-2 text-left text-gray-100 hover:bg-gray-950/20 active:bg-gray-950/40';

  const figmaColorGroups = [
    {
      name: 'Gray',
      colors: [
        {label: '#222121', className: 'bg-gray-950 border-gray-100'},
        {label: '#393A34', className: 'bg-gray-800 border-gray-100'},
        {label: '#2D2D2C', className: 'bg-gray-900 border-gray-100'},
        {label: '#F8F2E2', className: 'bg-gray-100 border-gray-950'},
        {label: '#D9D9D9', className: 'bg-gray-300 border-gray-950'}
      ]
    },
    {
      name: 'Primary',
      colors: [
        {label: '#FBB124', className: 'bg-primary-500 border-gray-100'},
        {label: '#EFDA39', className: 'bg-primary-400 border-gray-100'},
        {label: '#DAC300', className: 'bg-primary-600 border-gray-100'}
      ]
    },
    {
      name: 'Secondary',
      colors: [
        {label: '#CB9227', className: 'bg-accent-500 border-gray-100'},
        {label: '#AB9904', className: 'bg-accent-600 border-gray-100'}
      ]
    },
    {
      name: 'Accent',
      colors: [
        {label: '#86D24B', className: 'bg-secondary-500 border-gray-100'},
        {label: '#5A6C4C', className: 'bg-secondary-700 border-gray-100'}
      ]
    }
  ];
</script>

<main class="mx-auto grid w-full max-w-7xl justify-items-center gap-10 px-8 py-14">
  <header class="text-center">
    <h1 class="text-display mb-6">Components</h1>
    <p class="text-lead">Preview of Svelte components derived from the Figma library.</p>
  </header>

  <section class="grid w-full gap-4 mt-8 text-center">
    <div class="text-eyebrow">Figma Colors</div>
    <div class="flex place-items-center justify-center">
      <div class="grid gap-4 text-body pr-8 py-8 rounded-lg dark:bg-gray-900">
        {#each figmaColorGroups as group (group.name)}
          <div class="flex w-full flex-col items-center gap-4 md:flex-row md:items-center">
            <div class="text-label text-gray-300 md:w-32 md:text-right">
              {group.name}
            </div>
            <div class="flex flex-wrap items-center justify-center gap-4 md:justify-start">
              {#each group.colors as color (color.label)}
                <div class="flex items-center gap-2">
                  <span class={`h-5 w-5 rounded-full border ${color.className}`}></span>
                  <span>{color.label}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="grid w-full grid-cols-4 gap-10 place-items-center max-xl:grid-cols-2 max-md:grid-cols-1 mt-8">
    {#each entries as entry (entry.name)}
      <div class="grid w-full max-w-md place-items-center gap-5 text-center">
        <div class="text-label">{entry.name}</div>
        <div class="flex w-full items-center justify-center">
          {#if entry.type === 'component'}
            <svelte:component this={entry.component}/>
          {:else if entry.type === 'button'}
            <Button variant={entry.variant}>{entry.label}</Button>
          {:else if entry.type === 'dropdown'}
            <Dropdown label={entry.label} initialOpen={entry.initialOpen}>
              <button class={dropdownOptionClasses} type="button">Option 1</button>
              <button class={dropdownOptionClasses} type="button">Option 2</button>
              <button class={dropdownOptionClasses} type="button">Option 3</button>
            </Dropdown>
          {/if}
        </div>
      </div>
    {/each}
  </section>

  <section class="grid w-full gap-8 place-items-center">
    {#each widgets as widget (widget.name)}
      <div class="grid w-full place-items-center gap-4 text-center">
        <div class="text-label">{widget.name}</div>
        <div class="flex w-full items-center justify-center">
          <svelte:component this={widget.component}/>
        </div>
      </div>
    {/each}
  </section>

  <section class="grid w-full gap-8 place-items-center">
    {#each navbars as entry (entry.name)}
      <div class="grid w-full place-items-center gap-4 text-center">
        <div class="text-label">{entry.name}</div>
        <div class="flex w-full items-center justify-center">
          <Navbar variant={entry.variant}/>
        </div>
      </div>
    {/each}
  </section>
</main>
