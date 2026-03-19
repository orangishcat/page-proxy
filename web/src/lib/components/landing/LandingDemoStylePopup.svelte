<script lang="ts">
  const cssLines = [
    ".semicircle-top-right {",
    "  display: none;",
    "}",
  ];

  const previewLines = ['baseSelector: ".semicircle-top-right"', 'declarations: "display: none;"'];

  const propertyRows = [
    { label: "class", value: "semicircle tile highlighted" },
    { label: "selector", value: ".semicircle-top-right" },
    { label: "state", value: "selected" },
  ];
</script>

<div class="absolute inset-0 z-30 bg-black/50">
  <div
    class="absolute left-[12em] top-[3.75em] h-[28em] w-[45.3125em] overflow-hidden rounded-lg border border-gray-800 bg-gray-950 text-gray-100 shadow-2xl"
  >
    <div class="flex h-12 items-center gap-2.5 border-b border-gray-800 bg-gray-900 px-4">
      <span class="text-base font-medium">CSS inspector</span>
      <a
        href="https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_selectors"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-accent-400 hover:text-accent-300 hover:underline"
      >
        CSS selector reference
      </a>
      <div class="flex-1"></div>
      <select class="cursor-pointer rounded border border-white/15 bg-white/10 px-2 py-1 text-xs text-white" aria-label="Inspector mode">
        <option selected>CSS</option>
      </select>
      <button
        type="button"
        class="rounded border border-white/20 px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-gray-200"
        aria-label="Close popup"
      >
        x
      </button>
    </div>

    <div class="flex h-[calc(100%-3em)]">
      <div class="flex min-w-0 flex-1 flex-col gap-3 p-3">
        <div class="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-xs leading-6 text-[#efe2d4]">
          {#each cssLines as line}
            <div>{line}</div>
          {/each}
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 cursor-pointer rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-accent-400"
          >
            Save
          </button>
          <button
            type="button"
            class="flex-1 cursor-pointer rounded-md border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-gray-100 hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </div>

      <div class="flex w-64 min-w-0 flex-col gap-3 border-l border-gray-800 bg-black/20 p-3">
        <div class="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
          <span>Properties</span>
          <span class="rounded-full border border-accent-500/30 px-2 py-0.5 text-[0.65rem] text-accent-400">1 matching element</span>
        </div>

        <div class="overflow-hidden rounded-md border border-gray-800 bg-gray-950">
          <div class="flex min-h-12 items-center px-3 py-2 font-mono text-xs text-accent-400">
            <div class="space-y-0.5">
              {#each previewLines as line}
                <div>{line}</div>
              {/each}
            </div>
          </div>
        </div>

        <input
          class="rounded-md border border-gray-800 bg-gray-950 px-2 py-1.5 text-xs text-gray-100 outline-none placeholder:text-gray-500"
          type="text"
          value="display"
          aria-label="Property search"
        />

        <p class="text-xs text-gray-400">Edit the CSS on the left, then save to apply it inline to the selected element.</p>

        <div class="space-y-2 overflow-y-auto pr-1 text-sm">
          {#each propertyRows as row (row.label)}
            <div class="rounded-md border border-transparent bg-white/5 px-2 py-1">
              <div class="text-xs text-gray-500">{row.label}</div>
              <div class="truncate font-mono text-xs text-gray-100">{row.value}</div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>
