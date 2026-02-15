<script lang="ts">
  import { CircleQuestionMark, MousePointer, Navigation, Plus, Share } from "lucide-svelte";
  import Button from "$lib/components/Button.svelte";
  import CodeEditorMock from "$lib/components/landing/CodeEditorMock.svelte";

  const propertyRows = [
    { label: "ID", value: "shape-top-right" },
    { label: "Class", value: "shape tile highlighted" },
    { label: "Name", value: "Target tile" },
    { label: "Selector", value: "main > section > .shape-top-right" },
    { label: "BBox", value: "412, 131 @ 129, 129" },
  ];
</script>

<div class="flex h-[34.5625em] w-full overflow-hidden rounded-[1em] border border-[#383a35] bg-[#2c2d2a]">
  <section class="relative h-full flex-1 overflow-hidden bg-[#2b2c2a]">
    <p class="absolute left-1/2 top-[3.2em] z-10 w-[17em] -translate-x-1/2 text-center text-[1.125em] text-[#93948e]">
      Where should the object go?
    </p>

    <div class="absolute left-[4.1em] top-[13.9em] h-[5.7em] w-[5.7em] rounded-full border-[0.125em] border-[#67685f] bg-[#595a54]"></div>
    <div class="absolute left-[13.1em] top-[13.6em] h-[6.6em] w-[2.75em] rounded-[0.2em] border-[0.125em] border-[#67685f] bg-[#595a54]"></div>
    <div class="absolute left-[21.3em] top-[14.4em] h-[4.5em] w-[9.2em] rounded-[0.2em] border-[0.125em] border-[#67685f] bg-[#595a54] [clip-path:polygon(0%_100%,100%_100%,72%_0%)]"></div>
    <div class="absolute left-[12.4em] top-[7.3em] h-[5em] w-[5em] rounded-[0.25em] border-[0.125em] border-[#67685f] bg-[#595a54]"></div>

    <div class="absolute bottom-[3.15em] left-[13em] h-[8.75em] w-[12.95em] rounded-[0.5em] border-[0.125em] border-[#67685f] bg-[#595a54]"></div>
    <div class="absolute bottom-[3.15em] left-[16.35em] h-[6.25em] w-[6.25em] rounded-full border-[0.125em] border-[#67685f] bg-[#2b2c2a]"></div>

    <div class="target-focus absolute left-[21.7em] top-[8.05em] h-[8.05em] w-[8.05em] rounded-full border-[0.125em] border-[#67685f] bg-[#595a54]"></div>

    <div class="cursor-selector absolute left-0 top-0 z-20 rounded-full border border-white bg-black p-[0.3em] shadow-[0_0.3em_0.8em_rgba(0,0,0,0.5)]">
      <Navigation class="h-[1.45em] w-[1.45em] -scale-x-100 fill-black text-white" strokeWidth={2.1} />
    </div>
  </section>

  <aside class="flex h-full w-[36.205%] min-w-[21.35em] flex-col border-l border-[#383a35] bg-[#222121]">
    <section class="flex w-full shrink-0 flex-col bg-[#282824]" aria-label="Tool panel">
      <div class="flex h-[3.05em] items-center justify-between bg-[#393a34] px-[0.75em] py-[0.5em]">
        <div class="flex min-w-0 flex-1 items-center gap-[0.75em]">
          <Button
            class="!h-[2.2em] !w-[2.2em] rounded-lg !bg-accent-500 !p-0 text-white hover:!opacity-100"
            variant="outline"
            aria-label="Toggle selection mode"
          >
            <MousePointer class="h-[1.1em] w-[1.1em]" />
          </Button>
          <Button class="!h-[2.2em] !w-[2.2em] rounded-lg !bg-[#55503e] !p-0 text-white hover:opacity-55" variant="outline" aria-label="Create tool">
            <Plus class="h-[1.1em] w-[1.1em]" />
          </Button>
          <Button class="!h-[2.2em] !w-[2.2em] rounded-lg !bg-[#55503e] !p-0 text-[0.9em] text-white hover:opacity-55" variant="outline" aria-label="Selectors tool">
            $0
          </Button>
          <span class="truncate text-[0.9em] text-white">Select</span>
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

      <div class="relative flex min-h-0 h-[15.45em] flex-col px-[1em] py-[1em]">
        <div class="empty-state flex min-h-0 flex-1 items-center justify-center text-[0.75em] text-[#787d78]">
          <div class="flex flex-col items-center gap-[0.45em]">
            <span>Select an element to preview</span>
            <span>(Esc to cancel)</span>
          </div>
        </div>

        <div class="properties-state absolute inset-0 px-[1em] py-[1em]">
          <div class="grid grid-cols-[fit-content(7em)_minmax(0,1fr)] gap-x-[1em] gap-y-[0.5em] text-[0.73em]">
            {#each propertyRows as property (property.label)}
              <span class="truncate text-right text-[#787d78]">{property.label}</span>
              <span class="truncate text-left font-mono text-[#f2f3f2]">{property.value}</span>
            {/each}
          </div>

          <div class="save-selector-wrap mt-[1em] flex justify-center">
            <Button class="!w-[9.15em] !px-[0.8em] !py-[0.45em] text-[0.78em]" variant="primary">Save selector</Button>
          </div>
        </div>
      </div>
    </section>

    <div class="h-[0.5em] w-full shrink-0 bg-[#282824]"></div>

    <CodeEditorMock websiteText="example.com/*" />
  </aside>
</div>

<style>
  .cursor-selector {
    animation: cursor-slide-select 6s cubic-bezier(0.22, 0.89, 0.34, 1) infinite;
  }

  .target-focus {
    animation: target-selected 6s ease-in-out infinite;
  }

  .empty-state {
    animation: empty-state-fade 6s ease-in-out infinite;
  }

  .properties-state,
  .save-selector-wrap {
    animation: properties-fade 6s ease-in-out infinite;
  }

  @keyframes cursor-slide-select {
    0% {
      opacity: 0;
      transform: translate(39em, 21em) scale(1);
    }

    12% {
      opacity: 1;
    }

    52% {
      opacity: 1;
      transform: translate(22.6em, 8.75em) scale(1);
    }

    58% {
      opacity: 1;
      transform: translate(22.6em, 8.75em) scale(0.88);
    }

    64% {
      opacity: 1;
      transform: translate(22.6em, 8.75em) scale(1);
    }

    90% {
      opacity: 1;
      transform: translate(22.6em, 8.75em) scale(1);
    }

    100% {
      opacity: 0;
      transform: translate(22.6em, 8.75em) scale(1);
    }
  }

  @keyframes target-selected {
    0%,
    54% {
      border-color: #67685f;
      box-shadow: 0 0 0 0 rgba(170, 224, 129, 0);
    }

    62%,
    100% {
      border-color: #aae081;
      box-shadow: 0 0 0 0.24em rgba(170, 224, 129, 0.3);
    }
  }

  @keyframes empty-state-fade {
    0%,
    54% {
      opacity: 1;
      transform: translateY(0);
    }

    62%,
    100% {
      opacity: 0;
      transform: translateY(-0.25em);
    }
  }

  @keyframes properties-fade {
    0%,
    56% {
      opacity: 0;
      transform: translateY(0.4em);
    }

    64%,
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
