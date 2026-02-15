<script lang="ts">
  import { CircleQuestionMark, MousePointer, Plus, Share } from "lucide-svelte";
  import Button from "$lib/components/Button.svelte";
  import CodeEditorMock from "$lib/components/landing/CodeEditorMock.svelte";
</script>

<div class="relative flex h-[553px] w-full overflow-hidden rounded-2xl border border-[#383a35] bg-[#2c2d2a]">
  <div class="pointer-events-none absolute right-3 top-3 z-30 flex w-[92%] max-w-[261px] flex-col gap-2">
    <div class="pointer-events-auto rounded-md border border-[#61656b] bg-[#272a2f] px-2 py-2 text-xs text-[#e5e7ea] shadow-lg">
      <div class="mb-1 flex items-center justify-between gap-2">
        <div class="font-semibold uppercase tracking-wide">notification</div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] opacity-80">10:42:13 PM</span>
          <button
            type="button"
            class="rounded px-1 text-[10px] opacity-80 hover:bg-white/10 hover:opacity-100"
            aria-label="Dismiss console notification"
          >
            ×
          </button>
        </div>
      </div>

      <div class="font-mono text-[11px] leading-5 text-[#e5e7ea]">&quot;// TODO Finish the rest of the landing page later&quot;</div>
    </div>
  </div>

  <section class="relative h-full flex-1 overflow-hidden bg-[#2b2c2a]">
    <div class="absolute left-1/2 top-6 z-10 w-[261px] -translate-x-1/2 rounded-xl border border-[#45473f] bg-[#393a34] px-5 py-4">
      <p class="font-mono text-[12px] leading-[19px] text-white">&quot;// TODO Finish the rest of the landing page later&quot;</p>
    </div>

    <div class="absolute left-16 top-[104px] grid w-60 gap-3.5">
      <div class="h-[42px] rounded-[9px] border border-[#55574d] bg-[#3a3c34]"></div>
      <div class="h-[42px] rounded-[9px] border border-[#55574d] bg-[#3a3c34]"></div>
      <div class="h-[42px] rounded-[9px] border border-[#55574d] bg-[#3a3c34]"></div>
    </div>

    <div class="absolute bottom-16 left-20 h-28 w-[163px] rounded-xl border border-[#5f6258] bg-[#40433a]"></div>
    <div class="absolute bottom-[99px] left-[274px] h-[77px] w-[77px] rounded-full border border-[#5f6258] bg-[#40433a]"></div>
    <div class="absolute bottom-[53px] left-[349px] h-[90px] w-[138px] rounded-xl border border-[#5f6258] bg-[#40433a] [clip-path:polygon(0%_100%,100%_100%,67%_0%)]"></div>
  </section>

  <aside class="flex h-full w-[36.205%] min-w-[342px] flex-col border-l border-[#383a35] bg-[#222121]">
    <section class="flex w-full shrink-0 flex-col bg-[#282824]" aria-label="Tool panel">
      <div class="flex h-[49px] items-center justify-between bg-[#393a34] px-3 py-2">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <Button class="!h-[35px] !w-[35px] rounded-lg !bg-[#55503e] !p-0 text-white hover:opacity-55" variant="outline" aria-label="Toggle selection mode">
            <MousePointer class="h-[18px] w-[18px]" />
          </Button>
          <Button class="!h-[35px] !w-[35px] rounded-lg !bg-[#55503e] !p-0 text-white hover:opacity-55" variant="outline" aria-label="Create tool">
            <Plus class="h-[18px] w-[18px]" />
          </Button>
          <Button class="!h-[35px] !w-[35px] rounded-lg !bg-[#55503e] !p-0 text-[14px] text-white hover:opacity-55" variant="outline" aria-label="Selectors tool">
            $0
          </Button>
          <span class="truncate text-[14px] text-white">Export</span>
        </div>

        <div class="flex items-center gap-3.5">
          <Button class="!h-[35px] !w-[35px] rounded-lg !bg-[#55503e] !p-0 text-white hover:opacity-55" variant="outline" aria-label="Help">
            <CircleQuestionMark class="h-[18px] w-[18px]" />
          </Button>
          <Button class="!h-[35px] !w-[35px] rounded-lg !bg-secondary-500 !p-0 text-white hover:opacity-55" variant="outline" aria-label="Export tool">
            <Share class="h-[18px] w-[18px]" />
          </Button>
        </div>
      </div>

      <div class="h-[247px] px-4 py-4">
        <div class="rounded-xl border border-[#45473f] bg-[#252824] px-3.5 py-3 text-[12px] text-[#e5e7ea]">
          <div class="mb-2.5 font-semibold">Run Summary</div>
          <div class="space-y-1.5 text-[#9ea39e]">
            <p>4 selectors matched.</p>
            <p>1 style block injected.</p>
            <p>Notification pushed via <span class="font-mono text-[#fcb253]">pv.notification()</span>.</p>
          </div>
        </div>

      </div>
    </section>

    <div class="h-2 w-full shrink-0 bg-[#282824]"></div>

    <CodeEditorMock websiteText="localhost:5173/*" />
  </aside>
</div>
