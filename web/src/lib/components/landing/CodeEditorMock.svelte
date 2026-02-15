<script lang="ts">
  type TokenTone = "plain" | "comment" | "keyword" | "string" | "function" | "type" | "number";

  type CodeToken = {
    text: string;
    tone: TokenTone;
  };

  type CodeLine = {
    id: string;
    tokens: CodeToken[];
  };

  type Props = {
    showNotification?: boolean;
    notificationMessage?: string;
    websiteText?: string;
  };

  let {
    showNotification = false,
    notificationMessage = "Build complete: 4 selectors applied.",
    websiteText = "example.com/*",
  }: Props = $props();

  const codeLines: CodeLine[] = [
    {
      id: "line-1",
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
      id: "line-2",
      tokens: [
        { text: "import", tone: "keyword" },
        { text: " * as ", tone: "plain" },
        { text: "ps", tone: "type" },
        { text: " from ", tone: "plain" },
        { text: '"@page-proxy/pp/pp-style"', tone: "string" },
        { text: ";", tone: "plain" },
      ],
    },
    {
      id: "line-3",
      tokens: [
        { text: "import", tone: "keyword" },
        { text: " * as ", tone: "plain" },
        { text: "pv", tone: "type" },
        { text: " from ", tone: "plain" },
        { text: '"@page-proxy/pp/pp-event"', tone: "string" },
        { text: ";", tone: "plain" },
      ],
    },
    { id: "line-4", tokens: [] },
    { id: "line-5", tokens: [{ text: "// ==Page Proxy==", tone: "comment" }] },
    { id: "line-6", tokens: [{ text: "// @title Demo mod", tone: "comment" }] },
    {
      id: "line-7",
      tokens: [{ text: "// @website https://example.com/*", tone: "comment" }],
    },
    { id: "line-8", tokens: [{ text: "// @description Landing demo", tone: "comment" }] },
    { id: "line-9", tokens: [{ text: "// @author Page Proxy", tone: "comment" }] },
    { id: "line-10", tokens: [{ text: "// ==/Page Proxy==", tone: "comment" }] },
    { id: "line-11", tokens: [] },
    { id: "line-12", tokens: [{ text: "// ==Selectors==", tone: "comment" }] },
    {
      id: "line-13",
      tokens: [
        { text: "const", tone: "keyword" },
        { text: " card = ", tone: "plain" },
        { text: "pq", tone: "type" },
        { text: ".", tone: "plain" },
        { text: "selector", tone: "function" },
        { text: "({ ", tone: "plain" },
        { text: 'name', tone: "string" },
        { text: ": ", tone: "plain" },
        { text: '"CTA card"', tone: "string" },
        { text: " });", tone: "plain" },
      ],
    },
    { id: "line-14", tokens: [{ text: "// ==/Selectors==", tone: "comment" }] },
    { id: "line-15", tokens: [] },
    {
      id: "line-16",
      tokens: [
        { text: "pv", tone: "type" },
        { text: ".", tone: "plain" },
        { text: "notification", tone: "function" },
        { text: "(", tone: "plain" },
        { text: '"Hello world!"', tone: "string" },
        { text: ", ", tone: "plain" },
        { text: "4", tone: "number" },
        { text: ");", tone: "plain" },
      ],
    },
  ];

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

<section class="relative flex min-h-0 w-full flex-1 flex-col bg-[#282824] shadow-[0_0.25em_0.25em_rgba(0,0,0,0.25)]" aria-label="Code editor panel">
  <div class="flex h-[2.75em] w-full items-center justify-between bg-[#393a34] px-[1em]">
    <div class="flex items-center gap-[0.4em] text-[0.75em] text-[#e7e8ea]">
      <span>Demo mod</span>
      <span class="text-[#5e635e]">@</span>
      <span class="text-accent-500">{websiteText}</span>
    </div>
    <div class="h-[0.45em] w-[0.45em] rounded-full bg-[#6da7ff]"></div>
  </div>

  <div class="relative min-h-0 flex-1 overflow-hidden">
    <div class="h-full overflow-auto px-[0.65em] pb-[0.6em] pt-[0.55em] font-mono text-[0.69em] leading-[1.9em] text-[#efe2d4]">
      {#each codeLines as line (line.id)}
        <div class="min-h-[1.9em] whitespace-pre">
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
      <div class="pointer-events-none absolute right-[0.5em] top-[0.6em] z-20 flex w-[92%] max-w-[18em] flex-col gap-[0.5em]">
        <div class="pointer-events-auto rounded-md border border-[#61656b] bg-[#272a2f] px-2 py-2 text-xs text-[#e5e7ea] shadow-lg">
          <div class="mb-1 flex items-center justify-between gap-2">
            <div class="font-semibold uppercase tracking-wide">notification</div>
            <div class="flex items-center gap-2">
              <span class="text-[0.625rem] opacity-80">10:42:13 PM</span>
              <button
                type="button"
                class="rounded px-1 text-[0.625rem] opacity-80 hover:bg-white/10 hover:opacity-100"
                aria-label="Dismiss console notification"
              >
                ×
              </button>
            </div>
          </div>

          <div class="font-mono text-[0.6875rem] leading-5 text-[#e5e7ea]">{notificationMessage}</div>
        </div>
      </div>
    {/if}
  </div>
</section>
