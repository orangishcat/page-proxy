<script lang="ts" module>
  export type NavbarVariant = 'app' | 'dashboard' | 'landing';
</script>

<script lang="ts">
  import {Bell, Moon, Sun} from 'lucide-svelte';
  import AccountWidget from './AccountWidget.svelte';
  import {createEventDispatcher, onMount} from 'svelte';
  import Button from './Button.svelte';
  import logoUrl from '../../assets/logo.png';

  let {variant = 'app'} = $props<{ variant?: NavbarVariant }>();

  let isDarkMode = $state(true);
  const homeHref = $derived(variant === 'landing' ? '/' : '/app');
  const dispatch = createEventDispatcher<{ newfile: void }>();

  const navClasses =
    'grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-8 rounded-2xl bg-gray-200 px-8 py-3 text-gray-950 shadow-lg dark:bg-gray-900 dark:text-gray-100';
  const itemClasses =
    'text-nav rounded-full px-4 py-1.5 hover:underline underline-offset-4 opacity-60 hover:opacity-100 active:opacity-80 transition-all duration-150 cursor-pointer';

  const iconButtonClasses = 'grid place-items-center rounded-full p-0';

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

<nav class={navClasses} class:max-w-full={variant === 'app'}>
  <a class="flex items-center gap-1.5 justify-self-start" href={homeHref} aria-label="Page Proxy">
    <img src={logoUrl} alt="" class="h-10 w-10" draggable="false"/>
    <span class="text-title">Page Proxy</span>
  </a>

  <div class="flex flex-wrap items-center justify-center gap-2 justify-self-center">
    {#if variant === 'app'}
      <span class={itemClasses}>File</span>
      <span class={itemClasses}>Edit</span>
      <span class={itemClasses}>View</span>
      <span class={itemClasses}>Tools</span>
    {:else if variant === 'landing'}
      <a class={itemClasses} href="/">Tools</a>
      <a class={itemClasses} href="/">Explore</a>
      <a class={itemClasses} href="/">Export</a>
      <a class={itemClasses} href="/">Creator</a>
    {:else}
      <a class="{itemClasses} w-28 text-right" href="/">Explore</a>
      <a class={itemClasses} href="/">Dashboard</a>
      <button class="{itemClasses} w-28 text-left" type="button" onclick={() => dispatch('newfile')}>
        New
      </button>
    {/if}
  </div>

  <div class="flex flex-1 justify-self-end gap-6">
    <Button
      variant="outline"
      class={iconButtonClasses}
      type="button"
      aria-label="Toggle theme"
      onclick={toggleTheme}
    >
      {#if isDarkMode}
        <Sun class="h-4 w-4" strokeWidth={2.5} aria-hidden="true"/>
      {:else}
        <Moon class="h-4 w-4" strokeWidth={2.5} aria-hidden="true"/>
      {/if}
    </Button>
    {#if variant === 'landing'}
      <a href="/app" class="ml-4">
        <Button type="button">Get Started</Button>
      </a>
    {:else}
      <Button variant="outline" class={iconButtonClasses} type="button" aria-label="Notifications">
        <Bell class="h-4 w-4" strokeWidth={2.5} aria-hidden="true"/>
      </Button>
      <AccountWidget/>
    {/if}
  </div>
</nav>
