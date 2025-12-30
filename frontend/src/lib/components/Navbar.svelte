<script lang="ts" context="module">
  export type NavbarVariant = 'app' | 'dashboard' | 'other';
</script>

<script lang="ts">
  import { Bell, Moon, Sun } from 'lucide-svelte';
  import AccountWidget from '$lib/components/AccountWidget.svelte';
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';

  export let variant: NavbarVariant = 'app';

  let isDarkMode = true;

  const navClasses =
    'grid w-full max-w-7xl grid-cols-3 items-center gap-8 rounded-3xl bg-gray-200 px-8 py-4 text-gray-950 shadow-lg dark:bg-gray-800 dark:text-gray-100';

  const itemClasses =
    'text-nav rounded-full px-4 py-1.5 hover:underline underline-offset-4 opacity-60 hover:opacity-100 active:opacity-80 transition-all duration-150 cursor-pointer';

  const iconButtonClasses = 'grid h-10 w-10 place-items-center rounded-full p-0';

  const applyTheme = (theme: 'light' | 'dark') => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
      isDarkMode = true;
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      isDarkMode = false;
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleTheme = () => {
    applyTheme(isDarkMode ? 'light' : 'dark');
  };

  onMount(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      applyTheme(storedTheme);
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  });
</script>

<nav class={navClasses}>
  <span class="text-title justify-self-start">Page Proxy</span>

  <div class="flex flex-wrap items-center justify-center gap-2 justify-self-center">
    {#if variant === 'app'}
      <span class={itemClasses}>File</span>
      <span class={itemClasses}>Edit</span>
      <span class={itemClasses}>View</span>
      <span class={itemClasses}>Tools</span>
    {:else}
      <a class={itemClasses} href="/">Dashboard</a>
      <a class={itemClasses} href="/">Explore</a>
    {/if}
  </div>

  <div class="flex justify-self-end gap-2">
    {#if variant === 'other'}
      <Button type="button">Get Started</Button>
    {:else}
      <Button
        variant="accent"
        class={iconButtonClasses}
        type="button"
        aria-label="Toggle theme"
        on:click={toggleTheme}
      >
        {#if isDarkMode}
          <Sun class="h-4 w-4 text-secondary-500" aria-hidden="true" />
        {:else}
          <Moon class="h-4 w-4 text-secondary-500" aria-hidden="true" />
        {/if}
      </Button>
      <Button variant="accent" class={iconButtonClasses} type="button" aria-label="Notifications">
        <Bell class="h-4 w-4 text-secondary-500" aria-hidden="true" />
      </Button>
      <AccountWidget />
    {/if}
  </div>
</nav>
