<script lang="ts">
  import CodeEditorMock from "$lib/components/landing/CodeEditorMock.svelte";
  import LandingDemoToolbar from "$lib/components/landing/LandingDemoToolbar.svelte";
</script>

<div class="relative flex h-138 w-full overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
  <div class="pointer-events-none absolute right-3 top-3 z-30 flex w-11/12 max-w-64 flex-col gap-2">
    <div class="pointer-events-auto rounded-md border border-gray-600 bg-gray-900 px-2 py-2 text-xs text-gray-200 shadow-lg">
      <div class="mb-1 flex items-center justify-between gap-2">
        <div class="font-semibold uppercase tracking-wide">notification</div>
        <div class="flex items-center gap-2">
          <span class="text-xs opacity-80">10:42:13 PM</span>
          <button
            type="button"
            class="rounded px-1 text-xs opacity-80 hover:bg-gray-100/10 hover:opacity-100"
            aria-label="Dismiss console notification"
          >
            ×
          </button>
        </div>
      </div>

      <div class="font-mono text-xs leading-5 text-gray-200">&quot;// TODO Finish the rest of the landing page later&quot;</div>
    </div>
  </div>

  <section class="relative h-full flex-1 overflow-hidden bg-gray-900">
    <div class="absolute left-16.5 top-55.5 h-23 w-23 rounded-full border-2 border-gray-500 bg-gray-600"></div>
    <div class="absolute left-52.5 top-54.5 h-27 w-11 rounded border-2 border-gray-500 bg-gray-600"></div>
    <div class="absolute left-87.5 top-57.5 h-18 w-24 bg-gray-500 [clip-path:polygon(50%_0%,0%_100%,100%_100%)]">
      <div class="absolute inset-px bg-gray-600 [clip-path:polygon(50%_0%,0%_100%,100%_100%)]"></div>
    </div>
    <div class="absolute left-49.5 top-29.25 h-20 w-20 rounded border-2 border-gray-500 bg-gray-600"></div>

    <div class="absolute bottom-12.5 left-53.5 h-35 w-48 border-2 border-gray-500 bg-gray-600"></div>
    <div class="absolute bottom-12.5 left-63.75 h-21 w-28 rounded-t-full border-2 border-gray-500 bg-gray-900"></div>

    <div class="absolute left-86.75 top-32.25 h-16 w-32 rounded-t-full border-2 border-gray-500 bg-gray-600"></div>
  </section>

  <aside class="flex h-full w-2/5 min-w-85 flex-col border-l border-gray-800 bg-gray-950">
    <section class="flex w-full shrink-0 flex-col bg-gray-900" aria-label="Tool panel">
      <LandingDemoToolbar title="Export" />

      <div class="h-62 px-4 py-4">
        <div class="rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-3 text-xs text-gray-200">
          <div class="mb-2.5 font-semibold">Run Summary</div>
          <div class="space-y-1.5 text-gray-400">
            <p>4 selectors matched.</p>
            <p>1 style block injected.</p>
            <p>1 notification pushed.</p>
          </div>
        </div>

      </div>
    </section>

    <div class="h-2 w-full shrink-0 bg-gray-900"></div>

    <CodeEditorMock websiteText="localhost:5173/*" />
  </aside>
</div>
