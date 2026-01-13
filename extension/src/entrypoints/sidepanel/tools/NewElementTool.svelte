<script lang="ts">
  import {onDestroy} from 'svelte';
  import Button from '@/lib/components/Button.svelte';
  import type {ElementInfo} from '@/lib/selection';
  import type {ElementEntry} from './code-editor/state';
  import type {PropertyItem} from './select-tool/state';
  import {selectedInfo, hasSelection, propertyItems} from './select-tool/state';
  import {
    buildDefinitionComment,
    elementEntries,
    formatElementCode,
    insertDefinitions
  } from './code-editor/state';

  let elementName = $state('');
  let lastSelectedSelector = $state<string | null>(null);
  let hasSelectionValue = $state(false);
  let selectedInfoValue = $state<ElementInfo | null>(null);
  let propertyItemsValue = $state<PropertyItem[]>([]);
  let elementEntriesValue = $state<ElementEntry[]>([]);

  const unsubscribeHasSelection = hasSelection.subscribe((value) => {
    hasSelectionValue = value;
  });
  const unsubscribeSelectedInfo = selectedInfo.subscribe((value) => {
    selectedInfoValue = value;
  });
  const unsubscribePropertyItems = propertyItems.subscribe((value) => {
    propertyItemsValue = value;
  });
  const unsubscribeElementEntries = elementEntries.subscribe((value) => {
    elementEntriesValue = value;
  });

  onDestroy(() => {
    unsubscribeHasSelection();
    unsubscribeSelectedInfo();
    unsubscribePropertyItems();
    unsubscribeElementEntries();
  });

  const buildNewElementLines = (items: PropertyItem[]) =>
    items.map((item) => `${item.label}: ${item.value}`);

  const saveElementDefinition = () => {
    if (!selectedInfoValue) {
      return;
    }

    const entryName = elementName.trim() || 'Element';
    const entry = {
      name: entryName,
      selector: selectedInfoValue.selector,
      bbox: selectedInfoValue.boundingBox,
      attributes: selectedInfoValue.attributes
    };

    const index = elementEntriesValue.length + 1;
    const variableName = `element_${index}`;

    const commentLine = buildDefinitionComment(
      'element',
      entry.name,
      entry.selector,
      entry.bbox,
      entry.attributes,
      'attr'
    );

    const codeLine = formatElementCode(entry, variableName);

    if (!insertDefinitions([commentLine, codeLine])) {
      return;
    }

    elementName = `element-${index + 1}`;
  };

  const newElementLines = $derived.by(() => buildNewElementLines(propertyItemsValue));

  $effect(() => {
    if (!hasSelectionValue) {
      lastSelectedSelector = null;
      elementName = '';
      return;
    }

    if (!selectedInfoValue) {
      return;
    }

    if (selectedInfoValue.selector === lastSelectedSelector) {
      return;
    }

    lastSelectedSelector = selectedInfoValue.selector;
    const baseName = selectedInfoValue.id || selectedInfoValue.tag || 'element';
    const index = elementEntriesValue.length + 1;
    elementName = `${baseName}-${index}`;
  });
</script>

<div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4">
  {#if hasSelectionValue}
    <p class="text-body whitespace-pre-line">
      {newElementLines.join('\n')}
    </p>
  {/if}
  <div class="mt-auto flex justify-center">
    <Button
      class="w-full max-w-xs"
      variant="primary"
      onclick={saveElementDefinition}
      disabled={!hasSelectionValue}
    >
      Create element
    </Button>
  </div>
</div>
