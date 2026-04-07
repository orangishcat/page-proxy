<script lang="ts">
  import { SvelteMap } from "svelte/reactivity";
  import { Tooltip } from "bits-ui";
  import { RotateCw } from "lucide-svelte";
  import CopyablePropertyText from "../ui/CopyablePropertyText.svelte";
  import type { CssSelectorPart } from "./css-inspector";

  type PropertyItem = {
    key: string;
    label: string;
    value: string;
    rawValue: string | { x: number; y: number; width: number; height: number };
    primary: boolean;
  };

  type CssComputedStyleProperty = {
    key: string;
    value: string;
    originalValue: string;
    edited: boolean;
    originalOrder: number;
    declarationOrder: number | null;
  };

  type Props = {
    activeCssPart: CssSelectorPart | null;
    cssPropertyItems: PropertyItem[];
    cssComputedStyleProperties: CssComputedStyleProperty[];
    cssPreviewErrorMessage: string | null;
    matchingElementCount: number;
    hasNthOfTypeRule: boolean;
    isCssEditorFocused: boolean;
    onPropertyChange: (key: string, value: string) => void;
    onPropertyRevert: (key: string) => void;
    onRemoveNthOfType: () => void;
  };

  let {
    activeCssPart,
    cssPropertyItems,
    cssComputedStyleProperties,
    cssPreviewErrorMessage,
    matchingElementCount,
    hasNthOfTypeRule,
    isCssEditorFocused,
    onPropertyChange,
    onPropertyRevert,
    onRemoveNthOfType,
  }: Props = $props();

  let propertySearchTerm = $state("");
  let computedValueDrafts = $state<Record<string, string>>({});
  const computedInputRefs = new SvelteMap<string, HTMLInputElement>();

  const noMatchingElementsErrorMessages = new Set([
    "CSS selector matches no elements.",
    "Selector does not match any elements",
  ]);
  const hasNoMatchingElements = $derived(
    cssPreviewErrorMessage !== null && noMatchingElementsErrorMessages.has(cssPreviewErrorMessage),
  );
  const normalizedSearchTerm = $derived(propertySearchTerm.trim().toLowerCase());
  const filteredPropertyItems = $derived.by(() => {
    const searchTerm = normalizedSearchTerm;
    if (!searchTerm) return cssPropertyItems;
    return cssPropertyItems.filter(
      (p) => p.key.toLowerCase().includes(searchTerm) || p.value.toLowerCase().includes(searchTerm),
    );
  });
  const filteredComputedStyleProperties = $derived.by(() => {
    const searchTerm = normalizedSearchTerm;
    if (!searchTerm) return cssComputedStyleProperties;
    return cssComputedStyleProperties.filter(
      (p) => p.key.toLowerCase().includes(searchTerm) || p.value.toLowerCase().includes(searchTerm),
    );
  });

  const computedValueInput = (node: HTMLInputElement, key: string) => {
    let currentKey = key;
    computedInputRefs.set(currentKey, node);
    return {
      update(nextKey: string) {
        if (nextKey === currentKey) return;
        computedInputRefs.delete(currentKey);
        currentKey = nextKey;
        computedInputRefs.set(currentKey, node);
      },
      destroy() {
        computedInputRefs.delete(currentKey);
      },
    };
  };

  const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max)}…` : value);
  const formatMatchingElementsLabel = (count: number) => `${count} matching element${count === 1 ? "" : "s"}`;
  const getDraftValue = (key: string, fallbackValue: string) => computedValueDrafts[key] ?? fallbackValue;

  const setDraftValue = (key: string, value: string) => {
    computedValueDrafts = { ...computedValueDrafts, [key]: value };
  };

  const clearDraftValue = (key: string) => {
    if (!(key in computedValueDrafts)) return;
    const { [key]: _ignored, ...rest } = computedValueDrafts;
    computedValueDrafts = rest;
  };

  const focusComputedValueInput = (key: string) => {
    const input = computedInputRefs.get(key);
    if (!input) return;
    input.focus();
    input.select();
  };

  const commitComputedValue = (key: string, currentValue: string) => {
    const nextValue = getDraftValue(key, currentValue).trim();
    clearDraftValue(key);
    if (nextValue === currentValue.trim()) return;
    onPropertyChange(key, nextValue);
  };

  const revertComputedValue = (key: string) => {
    clearDraftValue(key);
    onPropertyRevert(key);
  };
</script>

<div class="flex flex-col w-64 max-w-64 min-w-0 border-l border-gray-800 bg-black/20 p-3 gap-3">
  {#if hasNoMatchingElements}
    <div class="flex h-full items-center justify-center text-center text-sm text-gray-400">
      Selector does not match any elements
    </div>
  {:else}
    {#if activeCssPart}
      <div class="space-y-1">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs uppercase tracking-wide text-gray-500">{activeCssPart.type}</span>
          <span class="font-mono text-xs text-accent-400 break-all">{activeCssPart.displayText}</span>
        </div>
        <p class="h-14 text-xs leading-5 text-gray-400">{activeCssPart.description}</p>
      </div>
    {:else}
      <div class="h-14 text-xs leading-5 text-gray-500">Place the text caret on a selector part to inspect it.</div>
    {/if}

    <div class="flex items-center justify-between gap-2">
      <div class="text-xs uppercase tracking-wide text-gray-500">Properties</div>
      <input
        type="search"
        bind:value={propertySearchTerm}
        placeholder="Search"
        class="h-6 w-28 rounded border border-white/15 bg-white/5 px-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-white/25 focus:outline-none"
        aria-label="Search CSS inspector properties"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
      <div class="flex flex-col gap-2">
        {#each filteredPropertyItems as item (item.key)}
          <div
            class="flex justify-between items-center rounded-md border border-transparent px-2 py-1 hover:bg-white/10"
          >
            <CopyablePropertyText text={item.key} align="left" class="flex-1 min-w-0 text-accent-500" />
            <CopyablePropertyText
              text={item.value}
              displayText={item.value.length > 18 ? `${item.value.length} chars` : truncate(item.value, 30)}
              title={item.value}
              class="max-w-28 text-secondary-500"
            />
          </div>
        {/each}

        {#if filteredPropertyItems.length === 0}
          <div class="text-xs text-gray-500 text-center p-2">No properties available.</div>
        {/if}

        <hr class="my-1 border-gray-800" />

        {#each filteredComputedStyleProperties as property (property.key)}
          {@const currentValue = getDraftValue(property.key, property.value)}
          {@const inputWidthCh = Math.max(5, currentValue.length + 1)}
          <div
            class={`relative flex justify-between items-center gap-2 rounded-md border px-2 py-1 overflow-visible transition-colors ${property.edited ? "border-accent-400/40 bg-accent-500/10" : "border-transparent hover:bg-white/10"}`}
            role="button"
            tabindex="0"
            onkeydown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                focusComputedValueInput(property.key);
              }
            }}
            onclick={() => focusComputedValueInput(property.key)}
          >
            {#if property.edited}
              <button
                type="button"
                class="absolute left-1 top-1/2 -translate-y-1/2 inline-flex h-4 w-4 items-center justify-center rounded text-accent-300 hover:bg-accent-400/20"
                onclick={(event) => {
                  event.stopPropagation();
                  revertComputedValue(property.key);
                }}
                aria-label={`Revert ${property.key}`}
              >
                <RotateCw class="h-3.5 w-3.5 -scale-x-100 text-gray-300 cursor-pointer" strokeWidth={2.75} />
              </button>
            {/if}

            <CopyablePropertyText
              text={property.key}
              align="left"
              class={`flex-1 min-w-0 text-accent-500 ${property.edited ? "pl-5" : ""}`}
              stopPropagation={true}
            />

            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <input
                    {...props}
                    type="text"
                    use:computedValueInput={property.key}
                    value={currentValue}
                    style={`width: ${inputWidthCh}ch;`}
                    class="h-6 shrink-0 rounded border border-transparent bg-transparent px-1 font-mono text-xs text-secondary-500 text-right hover:overflow-visible focus:border-white/20 focus:bg-white/5 focus:outline-none"
                    onclick={(event) => event.stopPropagation()}
                    oninput={(event) => setDraftValue(property.key, event.currentTarget.value)}
                    onblur={() => commitComputedValue(property.key, property.value)}
                    onkeydown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitComputedValue(property.key, property.value);
                        event.currentTarget.blur();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        clearDraftValue(property.key);
                        event.currentTarget.blur();
                      }
                    }}
                    aria-label={`Edit ${property.key}`}
                  />
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  sideOffset={6}
                  class="max-w-96 break-all rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-caption text-gray-100 shadow-lg"
                >
                  {currentValue}
                  <Tooltip.Arrow class="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        {/each}

        {#if filteredComputedStyleProperties.length === 0}
          <div class="text-xs text-gray-500 text-center p-2">No computed styles available.</div>
        {/if}
      </div>
    </div>

    <div class="mt-auto space-y-4">
      {#if hasNthOfTypeRule}
        <p class="text-xs text-gray-500">
          Want to broaden the selector?
          <button
            type="button"
            class="ml-1 cursor-pointer bg-transparent p-0 text-accent-400 underline decoration-accent-400/80 underline-offset-2 transition hover:text-accent-300"
            onclick={onRemoveNthOfType}
          >
            Remove nth-of-type
          </button>
        </p>
      {/if}

      <p class="text-xs text-gray-500">
        Hold <code>z</code> to highlight {formatMatchingElementsLabel(matchingElementCount)}{isCssEditorFocused
          ? " (unfocus code editor first)"
          : ""}
      </p>
      <p class="text-xs text-gray-500">
        Hold <code>x</code> to preview applied CSS styles{isCssEditorFocused ? " (unfocus code editor first)" : ""}
      </p>

      {#if cssPreviewErrorMessage}
        <p class="text-sm text-red-400">{cssPreviewErrorMessage}</p>
      {/if}
    </div>
  {/if}
</div>
