<script lang="ts">
  import { CircleQuestionMark, MousePointer, Navigation, Plus, Share } from "lucide-svelte";
  import Button from "$lib/components/Button.svelte";
  import CodeEditorMock from "$lib/components/landing/CodeEditorMock.svelte";

  const propertyRows = [
    { label: "ID", value: "semicircle-top-right" },
    { label: "Class", value: "semicircle tile highlighted" },
    { label: "Name", value: "Top-right semicircle" },
    { label: "Selector", value: "main > section > .semicircle-top-right" },
    { label: "BBox", value: "412, 131 @ 129, 64" },
  ];
</script>

<div class="flex h-[553px] w-full overflow-hidden rounded-2xl border border-[#383a35] bg-[#2c2d2a]">
  <section class="relative h-full flex-1 overflow-hidden bg-[#2b2c2a]">
    <div class="absolute left-[66px] top-[222px] h-[91px] w-[91px] rounded-full border-2 border-[#67685f] bg-[#595a54]"></div>
    <div class="absolute left-[210px] top-[218px] h-[106px] w-11 rounded-[3px] border-2 border-[#67685f] bg-[#595a54]"></div>
    <div class="absolute left-[341px] top-[230px] h-[72px] w-[147px] rounded-[3px] border-2 border-[#67685f] bg-[#595a54] [clip-path:polygon(0%_100%,100%_100%,72%_0%)]"></div>
    <div class="absolute left-[198px] top-[117px] h-20 w-20 rounded border-2 border-[#67685f] bg-[#595a54]"></div>

    <div class="absolute bottom-[50px] left-[214px] h-[140px] w-[194px] rounded-t-[96px] border-2 border-[#67685f] bg-[#595a54]"></div>
    <div class="absolute bottom-[50px] left-[255px] h-[84px] w-[112px] rounded-t-[56px] border-2 border-[#67685f] bg-[#2b2c2a]"></div>

    <div class="semicircle-top-right target-focus absolute left-[347px] top-[129px] h-[64px] w-[129px] rounded-t-full border-2 border-b-0 border-[#67685f] bg-[#595a54]"></div>

    <div class="cursor-selector absolute left-0 top-0 z-20 rounded-full border border-white bg-black p-[5px] shadow-[0_5px_13px_rgba(0,0,0,0.5)]">
      <Navigation class="h-[23px] w-[23px] -scale-x-100 fill-black text-white" strokeWidth={2.1} />
    </div>
  </section>

  <aside class="flex h-full w-[36.205%] min-w-[342px] flex-col border-l border-[#383a35] bg-[#222121]">
    <section class="flex w-full shrink-0 flex-col bg-[#282824]" aria-label="Tool panel">
      <div class="flex h-[49px] items-center justify-between bg-[#393a34] px-3 py-2">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <Button
            class="!h-[35px] !w-[35px] rounded-lg !bg-accent-500 !p-0 text-white hover:!opacity-100"
            variant="outline"
            aria-label="Toggle selection mode"
          >
            <MousePointer class="h-[18px] w-[18px]" />
          </Button>
          <Button class="!h-[35px] !w-[35px] rounded-lg !bg-[#55503e] !p-0 text-white hover:opacity-55" variant="outline" aria-label="Create tool">
            <Plus class="h-[18px] w-[18px]" />
          </Button>
          <Button class="!h-[35px] !w-[35px] rounded-lg !bg-[#55503e] !p-0 text-[14px] text-white hover:opacity-55" variant="outline" aria-label="Selectors tool">
            $0
          </Button>
          <span class="truncate text-[14px] text-white">Select</span>
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

      <div class="relative flex h-[247px] min-h-0 flex-col px-4 py-4">
        <div class="empty-state flex min-h-0 flex-1 items-center justify-center text-[12px] text-[#787d78]">
          <div class="flex flex-col items-center gap-2">
            <span>Select an element to preview</span>
            <span>(Esc to cancel)</span>
          </div>
        </div>

        <div class="properties-state absolute inset-0 px-4 py-4">
          <div class="grid grid-cols-[fit-content(112px)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[12px]">
            {#each propertyRows as property (property.label)}
              <span class="truncate text-right text-[#787d78]">{property.label}</span>
              <span class="truncate text-left font-mono text-[#f2f3f2]">{property.value}</span>
            {/each}
          </div>

          <div class="save-selector-wrap mt-4 flex justify-center">
            <Button class="!w-[146px] !px-3 !py-2 text-[12px]" variant="primary">Save selector</Button>
          </div>
        </div>
      </div>
    </section>

    <div class="h-2 w-full shrink-0 bg-[#282824]"></div>

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
      transform: translate(624px, 336px) scale(1);
    }

    12% {
      opacity: 1;
    }

    52% {
      opacity: 1;
      transform: translate(362px, 140px) scale(1);
    }

    58% {
      opacity: 1;
      transform: translate(362px, 140px) scale(0.88);
    }

    64% {
      opacity: 1;
      transform: translate(362px, 140px) scale(1);
    }

    90% {
      opacity: 1;
      transform: translate(362px, 140px) scale(1);
    }

    100% {
      opacity: 0;
      transform: translate(362px, 140px) scale(1);
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
      box-shadow: 0 0 0 4px rgba(170, 224, 129, 0.3);
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
      transform: translateY(-4px);
    }
  }

  @keyframes properties-fade {
    0%,
    56% {
      opacity: 0;
      transform: translateY(6px);
    }

    64%,
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
