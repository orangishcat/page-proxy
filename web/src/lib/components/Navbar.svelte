<script lang="ts" module>
  export type NavbarVariant = "app" | "dashboard" | "landing";
</script>

<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import { Bell, Moon, Sun } from "lucide-svelte";
  import AccountWidget from "$lib/components/AccountWidget.svelte";
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";

  type Props = {
    variant?: NavbarVariant;
    onNewFile?: () => void;
  };

  let { variant = "app", onNewFile }: Props = $props();

  let isDarkMode = $state(true);

  const navClasses =
    "grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-8 rounded-2xl bg-gray-200 px-8 py-3 text-gray-950 shadow-lg dark:bg-gray-900 dark:text-gray-100";
  const itemClasses =
    "text-nav rounded-full px-4 py-1.5 text-black dark:text-white hover:underline underline-offset-4 opacity-60 hover:opacity-100 active:opacity-80 transition-all duration-150 cursor-pointer";

  const iconButtonClasses = "grid place-items-center rounded-full p-0";

  const applyTheme = (theme: "light" | "dark") => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === "dark") {
      root.classList.add("dark");
      body.classList.add("dark");
      isDarkMode = true;
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      body.classList.remove("dark");
      isDarkMode = false;
      localStorage.setItem("theme", "light");
    }
  };

  const toggleTheme = () => {
    applyTheme(isDarkMode ? "light" : "dark");
  };

  onMount(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      applyTheme(storedTheme);
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  });
</script>

<nav class={navClasses} class:max-w-full={variant === "app"}>
  {#if variant === "landing"}
    <a class="flex items-center gap-1.5 justify-self-start -my-4 -mt-5 ml-4" href={resolve("/")} aria-label="Page Proxy">
      <img src={asset("/logo_text.png")} alt="" class="h-13" draggable="false" />
    </a>
  {:else}
    <a class="flex items-center gap-1.5 justify-self-start -my-4 -mt-5 ml-4" href={resolve("/")} aria-label="Page Proxy">
      <img src={asset("/logo_text.png")} alt="" class="h-13" draggable="false" />
    </a>
  {/if}

  <div class="flex flex-wrap items-center justify-center gap-2 justify-self-center">
    {#if variant === "app"}
      <span class={itemClasses}>File</span>
      <span class={itemClasses}>Edit</span>
      <span class={itemClasses}>View</span>
      <span class={itemClasses}>Tools</span>
    {:else if variant === "landing"}
      <a class={itemClasses} href={resolve("/") + "#tools"}>Tools</a>
      <a class={itemClasses} href={resolve("/") + "#explore"}>Explore</a>
      <!-- Docs are hosted externally in production; keep the typecast to avoid typing errors. -->
      <a class={itemClasses} href={resolve("/docs" as any)}>Docs</a>
    {:else if variant === "dashboard"}
      <a class="{itemClasses} w-28 text-right" href={resolve("/")}>Explore</a>
      <a class={itemClasses} href={resolve("/")}>Dashboard</a>
      <button class="{itemClasses} w-28 text-left" type="button" onclick={() => onNewFile?.()}> New </button>
    {/if}
  </div>

  <div class="flex flex-1 justify-self-end gap-6">
    <Button variant="outline" class={iconButtonClasses} type="button" aria-label="Toggle theme" onclick={toggleTheme}>
      {#if isDarkMode}
        <Sun class="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      {:else}
        <Moon class="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      {/if}
    </Button>
    {#if variant === "landing"}
      <a href={resolve("/install")} class="ml-4">
        <Button type="button" class="px-6">Install</Button>
      </a>
    {:else}
      <Button variant="outline" class={iconButtonClasses} type="button" aria-label="Notifications">
        <Bell class="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </Button>
      <AccountWidget />
    {/if}
  </div>
</nav>
