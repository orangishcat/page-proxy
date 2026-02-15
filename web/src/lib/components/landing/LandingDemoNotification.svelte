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
    <div class="absolute left-1/2 top-6 z-10 w-64 -translate-x-1/2 rounded-xl border border-gray-800 bg-gray-800 px-5 py-4">
      <p class="font-mono text-xs leading-5 text-gray-100">&quot;// TODO Finish the rest of the landing page later&quot;</p>
    </div>

    <div class="absolute left-16 top-26 grid w-60 gap-3.5">
      <div class="h-10 rounded-lg border border-gray-700 bg-gray-800"></div>
      <div class="h-10 rounded-lg border border-gray-700 bg-gray-800"></div>
      <div class="h-10 rounded-lg border border-gray-700 bg-gray-800"></div>
    </div>

    <div class="absolute bottom-16 left-20 h-28 w-40 rounded-xl border border-gray-600 bg-gray-800"></div>
    <div class="absolute bottom-24.75 left-68.5 h-20 w-20 rounded-full border border-gray-600 bg-gray-800"></div>
    <div class="absolute bottom-13.25 left-87.25 h-22 w-35 rounded-xl border border-gray-600 bg-gray-800 [clip-path:polygon(0%_100%,100%_100%,67%_0%)]"></div>
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
