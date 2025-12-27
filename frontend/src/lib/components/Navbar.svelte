<script lang="ts" context="module">
  export type NavbarVariant = 'app' | 'dashboard' | 'other';
</script>

<script lang="ts">
  import { Bell, User } from 'lucide-svelte';

  export let variant: NavbarVariant = 'app';

  const navClasses =
    'interactive-hover grid w-full max-w-7xl grid-cols-3 items-center gap-8 rounded-3xl bg-gray-800 px-8 py-4 text-gray-100 shadow-lg hover:bg-gray-900 active:bg-gray-950';

  const itemClasses =
    'interactive-hover text-nav rounded-full px-4 py-1.5 hover:bg-accent-500/15';

  const iconButtonClasses =
    'interactive-hover grid h-9 w-9 place-items-center rounded-full hover:bg-accent-500/15';

  const ctaClasses =
    'interactive-hover rounded-2xl border border-accent-500 bg-gradient-to-br from-primary-400 to-primary-500 px-5 py-2 text-button text-gray-100 hover:brightness-110 active:brightness-95';
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
      <button class={ctaClasses} type="button">Get Started</button>
    {:else}
      <button class={iconButtonClasses} type="button" aria-label="Notifications">
        <Bell class="h-4 w-4 text-secondary-500" aria-hidden="true" />
      </button>
      <button class={iconButtonClasses} type="button" aria-label="Account">
        <User class="h-4 w-4 text-secondary-500" aria-hidden="true" />
      </button>
    {/if}
  </div>
</nav>
