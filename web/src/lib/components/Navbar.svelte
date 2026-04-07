<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import { Moon, Sun } from "lucide-svelte";
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";

  let isDarkMode = $state(true);

  const navClasses =
    "fixed top-3 left-1/2 -translate-x-1/2 z-999 grid grid-cols-[1fr_auto_1fr] w-[95vw] max-w-7xl items-center gap-8 px-8 py-3 rounded-2xl bg-gray-200 dark:bg-gray-900/70 shadow-lg dark:border dark:border-gray-850 backdrop-blur-sm text-gray-950 dark:text-gray-100";
  const itemClasses =
    "cursor-pointer rounded-full px-4 py-1.5 text-nav text-black dark:text-white underline-offset-4 opacity-60 transition-all duration-150 hover:underline hover:opacity-100 active:opacity-80";

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

    applyTheme("dark");
  });
</script>

<nav class={navClasses}>
  <a class="flex items-center gap-1.5 justify-self-start -my-4 -mt-5" href={resolve("/")} aria-label="Page Proxy">
    <img src={asset("/logo_text.avif")} alt="" class="h-13" draggable="false" />
  </a>

  <div class="flex flex-wrap items-center justify-center gap-2 justify-self-center">
    <!-- Docs are hosted externally in production; keep the typecast to avoid typing errors. -->
    <a class={itemClasses} href={resolve("/docs" as any)}>Docs</a>
    <a class={itemClasses} href={resolve("/") + "#tools"}>Tools</a>
    <a class={itemClasses} href={resolve("/") + "#explore"}>Explore</a>
  </div>

  <div class="flex flex-1 justify-self-end gap-6">
    <Button variant="outline" class={iconButtonClasses} type="button" aria-label="Toggle theme" onclick={toggleTheme}>
      {#if isDarkMode}
        <Sun class="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      {:else}
        <Moon class="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      {/if}
    </Button>
    <a href={resolve("/install")} class="ml-4">
      <Button type="button" class="px-6">Install</Button>
    </a>
  </div>
</nav>
