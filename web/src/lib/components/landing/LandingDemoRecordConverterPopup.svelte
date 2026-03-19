<script lang="ts">
  const steps = [
    { label: "Selected element", step: "Step 1", active: false },
    { label: "Apply style", step: "Step 2", active: false },
    { label: "Selected element", step: "Step 3", active: false },
    { label: "Clicked element", step: "Step 4", active: false },
    { label: "Review", step: "Final step", active: true },
  ];

  const reviewLines = [
    'const heroArc = pq.selector(".semicircle-top-right");',
    'ps.injectCSS(`',
    '.semicircle-top-right {',
    '  display: none;',
    '}',
    '`);',
    'const waitlistButton = pq.selector(".cta-card button");',
    'pv.click(waitlistButton);',
  ];

  const selectorMatches = [".semicircle-top-right", ".cta-card button"];
</script>

<div class="absolute inset-0 z-40 bg-black/50">
  <div class="flex h-full items-center justify-center p-4">
    <section
      class="flex h-full max-h-[40em] w-full max-w-5xl min-h-0 flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-white shadow-2xl"
      aria-label="Record converter popup"
    >
      <header class="flex items-center gap-3 border-b border-gray-700 bg-[#232323] px-5 py-3">
        <div class="min-w-0">
          <h2 class="text-base font-medium">Convert to code</h2>
        </div>
        <div class="flex-1"></div>
        <button
          type="button"
          class="rounded-md border border-white/20 px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-gray-200"
          aria-label="Close popup"
        >
          x
        </button>
      </header>

      <div class="flex min-h-0 flex-1">
        <aside class="flex w-56 shrink-0 flex-col border-r border-gray-700 bg-gray-950">
          <div class="border-b border-gray-700 px-4 py-3">
            <p class="text-xs text-gray-300">Supported steps: 4</p>
          </div>
          <ol class="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {#each steps as step (step.step)}
              <li>
                <div
                  class={`rounded-lg border px-3 py-2 text-left ${
                    step.active
                      ? "border-accent-500/60 bg-accent-500/15 text-white"
                      : "border-transparent text-gray-300"
                  }`}
                >
                  <p class="text-xs text-gray-400">{step.step}</p>
                  <p class="text-sm">{step.label}</p>
                </div>
              </li>
            {/each}
          </ol>
        </aside>

        <section class="flex min-h-0 flex-1 flex-col">
          <div class="border-b border-gray-700 px-4 py-3">
            <div class="flex flex-wrap items-center gap-3">
              <div>
                <h3 class="text-base font-medium">Review generated code</h3>
                <p class="text-xs text-gray-300">Edit as needed before saving.</p>
              </div>
              <div class="flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800/70 p-1">
                <button type="button" class="rounded-sm bg-gray-600 px-2 py-1 text-xs text-white">Combined code</button>
                <button type="button" class="rounded-sm px-2 py-1 text-xs text-gray-200">Functions</button>
              </div>
              <div class="flex-1"></div>
              <button type="button" class="rounded-md border border-gray-600 px-3 py-1 text-xs text-gray-200">
                Reset to generated
              </button>
            </div>
          </div>

          <div class="flex min-h-0 flex-1 flex-col p-4">
            <div class="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-700 bg-gray-950 p-3 font-mono text-xs leading-6 text-[#efe2d4]">
              {#each reviewLines as line}
                <div>{line}</div>
              {/each}
            </div>
          </div>
        </section>

        <aside class="flex w-60 shrink-0 flex-col border-l border-gray-700 bg-gray-950">
          <div class="border-b border-gray-700 px-4 py-3">
            <p class="text-xs uppercase tracking-wide text-gray-500">Suggested selectors</p>
          </div>
          <div class="space-y-2 px-3 py-3">
            {#each selectorMatches as match}
              <div class="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-200">{match}</div>
            {/each}
          </div>
        </aside>
      </div>

      <footer class="border-t border-gray-700 bg-gray-950 px-4 py-3">
        <div class="mt-3 flex items-center justify-end gap-2">
          <button type="button" class="rounded-md border border-gray-600 px-4 py-2 text-xs text-gray-200">Cancel</button>
          <button type="button" class="rounded-md border border-gray-600 px-4 py-2 text-xs text-gray-200">Previous</button>
          <button type="button" class="rounded-md bg-accent-500 px-4 py-2 text-xs font-medium text-white">Save</button>
        </div>
      </footer>
    </section>
  </div>
</div>
