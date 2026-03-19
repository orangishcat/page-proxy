<script lang="ts" module>
  export type TokenTone = "plain" | "comment" | "keyword" | "string" | "function" | "type" | "number";

  export type CodeToken = {
    text: string;
    tone: TokenTone;
  };

  export type CodeLine = {
    id: string;
    tokens: CodeToken[];
  };
</script>

<script lang="ts">
  type Props = {
    codeLines?: CodeLine[];
    highlightedLineIds?: string[];
    showNotification?: boolean;
    notificationMessage?: string;
    websiteText?: string;
    title?: string;
  };

  const defaultCodeLines: CodeLine[] = [
    {
      id: "import-pq",
      tokens: [
        { text: "import", tone: "keyword" },
        { text: " * as ", tone: "plain" },
        { text: "pq", tone: "type" },
        { text: " from ", tone: "plain" },
        { text: '"@page-proxy/pp/pp-query"', tone: "string" },
        { text: ";", tone: "plain" },
      ],
    },
    {
      id: "import-pv",
      tokens: [
        { text: "import", tone: "keyword" },
        { text: " * as ", tone: "plain" },
        { text: "pv", tone: "type" },
        { text: " from ", tone: "plain" },
        { text: '"@page-proxy/pp/pp-event"', tone: "string" },
        { text: ";", tone: "plain" },
      ],
    },
    { id: "spacer-1", tokens: [] },
    { id: "meta-1", tokens: [{ text: "// ==Page Proxy==", tone: "comment" }] },
    { id: "meta-2", tokens: [{ text: "// @title Demo mod", tone: "comment" }] },
    { id: "meta-3", tokens: [{ text: "// @website https://example.com/*", tone: "comment" }] },
    { id: "meta-4", tokens: [{ text: "// ==/Page Proxy==", tone: "comment" }] },
    { id: "spacer-2", tokens: [] },
    { id: "placeholder", tokens: [{ text: "// Select a tool to generate code", tone: "comment" }] },
  ];

  let {
    codeLines = defaultCodeLines,
    highlightedLineIds = [],
    showNotification = false,
    notificationMessage = "Build complete: 4 selectors applied.",
    websiteText = "example.com/*",
    title = "Demo mod",
  }: Props = $props();

  const highlightedLineIdSet = $derived(new Set(highlightedLineIds));

  const toneClasses = {
    plain: "text-[#efe2d4]",
    comment: "text-[#93a1a1]",
    keyword: "text-[#ff8f3f]",
    string: "text-[#669900]",
    function: "text-[#fcb253]",
    type: "text-[#59c2ff]",
    number: "text-[#ee9900]",
  } satisfies Record<TokenTone, string>;
</script>

<section
  class="relative flex min-h-0 w-full flex-1 flex-col bg-[#282824] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
  aria-label="Code editor panel"
>
  <div class="flex h-11 w-full items-center justify-between bg-[#393a34] px-4">
    <div class="flex items-center gap-1.5 text-xs text-[#e7e8ea]">
      <span>{title}</span>
      <span class="text-[#5e635e]">@</span>
      <span class="text-accent-500">{websiteText}</span>
    </div>
    <div class="h-2 w-2 rounded-full bg-[#6da7ff]"></div>
  </div>

  <div class="relative min-h-0 flex-1 overflow-hidden">
    <div class="h-full overflow-auto px-2.5 pb-2.5 pt-2 font-mono text-xs leading-5 text-[#efe2d4]">
      {#each codeLines as line (line.id)}
        <div
          class={`min-h-5 whitespace-pre rounded-md px-2 transition-all duration-300 ${
            highlightedLineIdSet.has(line.id) ? "bg-accent-500/12 shadow-[inset_0_0_0_1px_rgba(187,147,72,0.35)]" : ""
          }`}
        >
          {#if line.tokens.length === 0}
            <span class="text-transparent">.</span>
          {:else}
            {#each line.tokens as token, tokenIndex (`${line.id}-${tokenIndex}`)}
              <span class={toneClasses[token.tone]}>{token.text}</span>
            {/each}
          {/if}
        </div>
      {/each}
    </div>

    {#if showNotification}
      <div class="pointer-events-none absolute right-2 top-2.5 z-20 flex w-[92%] max-w-72 flex-col gap-2">
        <div class="pointer-events-auto rounded-md border border-[#61656b] bg-[#272a2f] px-2 py-2 text-xs text-[#e5e7ea] shadow-lg">
          <div class="mb-1 flex items-center justify-between gap-2">
            <div class="font-semibold uppercase tracking-wide">notification</div>
            <div class="flex items-center gap-2">
              <span class="text-xs opacity-80">10:42:13 PM</span>
              <button
                type="button"
                class="rounded px-1 text-xs opacity-80 hover:bg-white/10 hover:opacity-100"
                aria-label="Dismiss console notification"
              >
                ×
              </button>
            </div>
          </div>

          <div class="font-mono text-xs leading-5 text-[#e5e7ea]">{notificationMessage}</div>
        </div>
      </div>
    {/if}
  </div>
</section>
