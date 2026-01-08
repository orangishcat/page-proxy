<svelte:head>
  <title>Dashboard</title>
</svelte:head>

<script lang="ts">
  import {Bell, Moon, Sun, User} from 'lucide-svelte';
  import {onMount} from 'svelte';
  import logoUrl from '../../assets/logo.png';

  type FileEntry = {
    id: string;
    name: string;
    source: 'appwrite' | 'local';
  };

  let files = $state<FileEntry[]>([]);
  let status = $state<'idle' | 'loading' | 'error'>('idle');
  let errorMessage = $state<string | null>(null);
  let isDarkMode = $state(true);

  const navItemClasses =
    'text-nav rounded-full px-4 py-1.5 opacity-60 transition-all duration-150 hover:opacity-100 hover:underline underline-offset-4 active:opacity-80';
  const iconButtonClasses =
    'grid place-items-center rounded-full border border-gray-200 bg-gray-100 p-2 text-gray-700 shadow-md transition hover:bg-gray-200 active:bg-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:active:bg-gray-600';

  const applyTheme = (theme: 'light' | 'dark') => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
      isDarkMode = true;
      localStorage.setItem('theme', 'dark');
      return;
    }

    root.classList.remove('dark');
    body.classList.remove('dark');
    isDarkMode = false;
    localStorage.setItem('theme', 'light');
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

<main class="min-h-screen text-gray-100">
  <div class="relative mx-auto flex w-full flex-col items-center justify-center gap-14 px-32 pb-20 pt-6">
    <nav
      class="grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-8 rounded-2xl bg-gray-200 px-8 py-3 text-gray-950 shadow-lg dark:bg-gray-900 dark:text-gray-100"
    >
      <div class="flex items-center gap-1.5 justify-self-start">
        <img src={logoUrl} alt="" class="h-10 w-10" draggable="false" />
        <span class="text-title">Page Proxy</span>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-2 justify-self-center">
        <span class={navItemClasses}>Explore</span>
        <span class={navItemClasses}>Dashboard</span>
        <button class={navItemClasses} type="button">New</button>
      </div>

      <div class="flex flex-1 justify-self-end gap-6">
        <button
          class={iconButtonClasses}
          type="button"
          aria-label="Toggle theme"
          onclick={toggleTheme}
        >
          {#if isDarkMode}
            <Sun class="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          {:else}
            <Moon class="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          {/if}
        </button>
        <button class={iconButtonClasses} type="button" aria-label="Notifications">
          <Bell class="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </button>
        <div class="grid h-10 w-10 place-items-center rounded-full bg-accent-500">
          <User class="h-5 w-5 text-gray-950" aria-hidden="true" />
        </div>
      </div>
    </nav>

    <section class="relative grid min-h-[18rem] w-full max-w-7xl gap-6 pb-6 md:grid-cols-3 lg:grid-cols-4">
      {#if status === 'loading'}
        <div class="col-span-full flex min-h-[18rem] items-center justify-center text-lead text-gray-300">
          Loading files...
        </div>
      {:else if files.length === 0}
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <div class="text-lead font-semibold text-gray-100">No files yet</div>
            <p class="text-body mt-2 text-gray-300">Create a new text file to get started.</p>
          </div>
        </div>
      {:else}
        {#each files as file (file.id)}
          <article
            class="relative w-full rounded-3xl border border-gray-200 bg-white p-6 text-gray-950 shadow-lg transition hover:ring-1 hover:ring-gray-500/70 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
          >
            <div class="relative z-10">
              <div class="mb-5 h-40 rounded-3xl bg-gray-200 dark:bg-gray-850"></div>
            </div>
            <div class="relative z-10 flex items-center gap-4">
              <div class="flex min-w-0 flex-1 flex-col gap-1 text-left">
                <strong class="text-title truncate">{file.name}</strong>
                <span class="text-body truncate">
                  {file.source === 'appwrite' ? 'Appwrite' : 'Local file'}
                </span>
              </div>
            </div>
          </article>
        {/each}
      {/if}
    </section>

    {#if status === 'error' && errorMessage}
      <p class="text-body text-red-200">{errorMessage}</p>
    {/if}
  </div>
</main>
