<script lang="ts">
  import type { PropertyItem } from "@/lib/utils/element-info";
  import CopyablePropertyText from "../../ui/CopyablePropertyText.svelte";
  import type { FilterOperator } from "./preview-code";
  import { truncatePropertyValue } from "./selector-popup-dnd";

  type Props = {
    hasNoMatchingElements: boolean;
    isActiveSpecialProperty: boolean;
    filterOperator: FilterOperator;
    onFilterOperatorChange: (operator: FilterOperator) => void;
    propertySearchTerm: string;
    onPropertySearchTermChange: (value: string) => void;
    activePropertyKey: string | null;
    filteredSpecialPropertyItems: PropertyItem[];
    filteredNonSpecialPropertyItems: PropertyItem[];
    onSelectPropertyKey: (key: string) => void;
    selectorMatchCount: number;
    isSelectorEditorFocused: boolean;
  };

  let {
    hasNoMatchingElements,
    isActiveSpecialProperty,
    filterOperator,
    onFilterOperatorChange,
    propertySearchTerm,
    onPropertySearchTermChange,
    activePropertyKey,
    filteredSpecialPropertyItems,
    filteredNonSpecialPropertyItems,
    onSelectPropertyKey,
    selectorMatchCount,
    isSelectorEditorFocused,
  }: Props = $props();

  const formatMatchingElementsLabel = (count: number) => `${count} matching element${count === 1 ? "" : "s"}`;
</script>

{#if hasNoMatchingElements}
  <div class="flex h-full items-center justify-center text-center text-sm text-gray-400">
    Selector does not match any elements
  </div>
{:else}
  <div class="text-xs uppercase tracking-wide text-gray-500">Property filters</div>

  {#if !isActiveSpecialProperty}
    <div class="flex flex-col gap-1">
      <select
        value={filterOperator}
        onchange={(event) => onFilterOperatorChange(event.currentTarget.value as FilterOperator)}
        class="text-sm text-white bg-white/10 border border-white/15 py-1.5 px-2 rounded cursor-pointer"
      >
        <option value="contains">contains</option>
        <option value="matches">matches</option>
        <option value="keyExists">keyExists</option>
      </select>
    </div>
  {/if}

  <div class="flex items-center justify-between gap-2">
    <div class="text-xs uppercase tracking-wide text-gray-500">Properties</div>
    <input
      type="search"
      value={propertySearchTerm}
      oninput={(event) => onPropertySearchTermChange(event.currentTarget.value)}
      placeholder="Search"
      class="h-6 w-28 rounded border border-white/15 bg-white/5 px-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-white/25 focus:outline-none"
      aria-label="Search properties"
    />
  </div>

  <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
    <div class="flex flex-col gap-2">
      {#each filteredSpecialPropertyItems as item (item.key)}
        <button
          type="button"
          onclick={() => onSelectPropertyKey(item.key)}
          class={`flex justify-between items-center text-left rounded-md border border-transparent px-2 py-1 cursor-pointer transition-colors hover:bg-white/10 ${activePropertyKey === item.key ? "bg-white/10 border-white/10" : ""}`}
          aria-pressed={activePropertyKey === item.key}
        >
          <CopyablePropertyText text={item.key} align="left" class="max-w-24 text-accent-500" stopPropagation={true} />
          <CopyablePropertyText
            text={item.value}
            displayText={item.value.length > 18 ? `${item.value.length} chars` : truncatePropertyValue(item.value, 30)}
            title={item.value}
            class="max-w-28 text-secondary-500"
            stopPropagation={true}
          />
        </button>
      {/each}

      {#if filteredSpecialPropertyItems.length > 0 && filteredNonSpecialPropertyItems.length > 0}
        <hr class="border-gray-800" />
      {/if}

      {#each filteredNonSpecialPropertyItems as item (item.key)}
        <button
          type="button"
          onclick={() => onSelectPropertyKey(item.key)}
          class={`flex justify-between items-center text-left rounded-md border border-transparent px-2 py-1 cursor-pointer transition-colors hover:bg-white/10 ${activePropertyKey === item.key ? "bg-white/10 border-white/10" : ""}`}
          aria-pressed={activePropertyKey === item.key}
        >
          <CopyablePropertyText text={item.key} align="left" class="max-w-24 text-accent-500" stopPropagation={true} />
          <CopyablePropertyText
            text={item.value}
            displayText={item.value.length > 18 ? `${item.value.length} chars` : truncatePropertyValue(item.value, 30)}
            title={item.value}
            class="max-w-28 text-secondary-500"
            stopPropagation={true}
          />
        </button>
      {/each}

      {#if filteredSpecialPropertyItems.length === 0 && filteredNonSpecialPropertyItems.length === 0}
        <div class="col-span-full text-xs text-gray-500 text-center p-4">No properties available.</div>
      {/if}
    </div>
  </div>
  <p class="mt-auto text-xs text-gray-500">
    Hold <code>z</code> to highlight {formatMatchingElementsLabel(selectorMatchCount)}{isSelectorEditorFocused
      ? " (unfocus code editor first)"
      : ""}
  </p>
{/if}
