<script lang="ts">
  import { CircleQuestionMark, MousePointer, Plus, Share } from "lucide-svelte";
  import Button from "$lib/components/Button.svelte";
  import CodeEditorMock from "$lib/components/landing/CodeEditorMock.svelte";
</script>

<div class="flex h-[34.5625em] w-full overflow-hidden rounded-[1em] border border-[#383a35] bg-[#2c2d2a]">
  <section class="relative h-full flex-1 overflow-hidden bg-[#2b2c2a]">
    <div class="absolute left-1/2 top-[1.5em] z-10 w-[16.32em] -translate-x-1/2 rounded-[0.7em] border border-[#45473f] bg-[#393a34] px-[1.25em] py-[1.1em]">
      <p class="font-mono text-[0.75em] leading-[1.6em] text-white">&quot;// TODO Finish the rest of the landing page later&quot;</p>
    </div>

    <div class="absolute left-[4em] top-[6.5em] grid w-[15em] gap-[0.9em]">
      <div class="h-[2.6em] rounded-[0.55em] border border-[#55574d] bg-[#3a3c34]"></div>
      <div class="h-[2.6em] rounded-[0.55em] border border-[#55574d] bg-[#3a3c34]"></div>
      <div class="h-[2.6em] rounded-[0.55em] border border-[#55574d] bg-[#3a3c34]"></div>
    </div>

    <div class="absolute bottom-[4em] left-[5em] h-[7em] w-[10.2em] rounded-[0.75em] border border-[#5f6258] bg-[#40433a]"></div>
    <div class="absolute bottom-[6.2em] left-[17.1em] h-[4.8em] w-[4.8em] rounded-full border border-[#5f6258] bg-[#40433a]"></div>
    <div class="absolute bottom-[3.3em] left-[21.8em] h-[5.6em] w-[8.6em] rounded-[0.8em] border border-[#5f6258] bg-[#40433a] [clip-path:polygon(0%_100%,100%_100%,67%_0%)]"></div>
  </section>

  <aside class="flex h-full w-[36.205%] min-w-[21.35em] flex-col border-l border-[#383a35] bg-[#222121]">
    <section class="flex w-full shrink-0 flex-col bg-[#282824]" aria-label="Tool panel">
      <div class="flex h-[3.05em] items-center justify-between bg-[#393a34] px-[0.75em] py-[0.5em]">
        <div class="flex min-w-0 flex-1 items-center gap-[0.75em]">
          <Button class="!h-[2.2em] !w-[2.2em] rounded-lg !bg-[#55503e] !p-0 text-white hover:opacity-55" variant="outline" aria-label="Toggle selection mode">
            <MousePointer class="h-[1.1em] w-[1.1em]" />
          </Button>
          <Button class="!h-[2.2em] !w-[2.2em] rounded-lg !bg-[#55503e] !p-0 text-white hover:opacity-55" variant="outline" aria-label="Create tool">
            <Plus class="h-[1.1em] w-[1.1em]" />
          </Button>
          <Button class="!h-[2.2em] !w-[2.2em] rounded-lg !bg-[#55503e] !p-0 text-[0.9em] text-white hover:opacity-55" variant="outline" aria-label="Selectors tool">
            $0
          </Button>
          <span class="truncate text-[0.9em] text-white">Export</span>
        </div>

        <div class="flex items-center gap-[0.85em]">
          <Button class="!h-[2.2em] !w-[2.2em] rounded-lg !bg-[#55503e] !p-0 text-white hover:opacity-55" variant="outline" aria-label="Help">
            <CircleQuestionMark class="h-[1.1em] w-[1.1em]" />
          </Button>
          <Button class="!h-[2.2em] !w-[2.2em] rounded-lg !bg-secondary-500 !p-0 text-white hover:opacity-55" variant="outline" aria-label="Export tool">
            <Share class="h-[1.1em] w-[1.1em]" />
          </Button>
        </div>
      </div>

      <div class="h-[15.45em] px-[1em] py-[1em]">
        <div class="rounded-[0.75em] border border-[#45473f] bg-[#252824] px-[0.9em] py-[0.85em] text-[0.73em] text-[#e5e7ea]">
          <div class="mb-[0.6em] font-semibold">Run Summary</div>
          <div class="space-y-[0.4em] text-[#9ea39e]">
            <p>4 selectors matched.</p>
            <p>1 style block injected.</p>
            <p>Notification pushed via <span class="font-mono text-[#fcb253]">pv.notification()</span>.</p>
          </div>
        </div>

        <div class="mt-[0.8em] flex justify-center">
          <Button class="!w-[8.7em] !px-[0.8em] !py-[0.45em] text-[0.78em]" variant="primary">Run script</Button>
        </div>
      </div>
    </section>

    <div class="h-[0.5em] w-full shrink-0 bg-[#282824]"></div>

    <CodeEditorMock
      showNotification={true}
      websiteText="localhost:5173/*"
      notificationMessage="Hello world! 4"
    />
  </aside>
</div>
