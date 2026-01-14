<script lang="ts">
  import {onDestroy} from 'svelte';
  import Button from '@/lib/components/Button.svelte';
  import type {ElementInfo} from '@/lib/selection';
  import type {StyleEntry} from './code-editor/state';
  import type {PropertyItem} from './select-tool/state';
  import {hasSelection, propertyItems, selectedInfo} from './select-tool/state';
  import {
    formatStyleCode,
    insertDefinitions,
    styleEntries
  } from './code-editor/state';
  import {setErrorMessage} from './tool-errors';
  import {Save} from "lucide-svelte";

  let styleName = $state('');
  let propertySelections = $state<Record<string, boolean>>({});
  let lastSelectedSelector = $state<string | null>(null);
  let hasSelectionValue = $state(false);
  let selectedInfoValue = $state<ElementInfo | null>(null);
  let propertyItemsValue = $state<PropertyItem[]>([]);
  let styleEntriesValue = $state<StyleEntry[]>([]);

  const unsubscribeHasSelection = hasSelection.subscribe((value) => {
    hasSelectionValue = value;
  });
  const unsubscribeSelectedInfo = selectedInfo.subscribe((value) => {
    selectedInfoValue = value;
  });
  const unsubscribePropertyItems = propertyItems.subscribe((value) => {
    propertyItemsValue = value;
  });
  const unsubscribeStyleEntries = styleEntries.subscribe((value) => {
    styleEntriesValue = value;
  });

  onDestroy(() => {
    unsubscribeHasSelection();
    unsubscribeSelectedInfo();
    unsubscribePropertyItems();
    unsubscribeStyleEntries();
  });

  const setPropertySelectionsFromItems = () => {
    const nextSelections: Record<string, boolean> = {};
    propertyItemsValue.forEach((item) => {
      nextSelections[item.key] = item.primary;
    });
    propertySelections = nextSelections;
  };

  const saveStyleDefinition = () => {
    if (!selectedInfoValue) {
      return;
    }

    const selectedProperties = propertyItemsValue.filter(
      (item) => propertySelections[item.key]
    );

    if (selectedProperties.length === 0) {
      setErrorMessage('Select at least one property to save a style.');
      return;
    }

    const entryName = styleName.trim() || 'Style';
    const properties: Record<string, string> = {};
    let bbox: (typeof selectedProperties)[number]['rawValue'] | null = null;

    selectedProperties.forEach((item) => {
      if (item.key === 'bbox' && typeof item.rawValue !== 'string') {
        bbox = item.rawValue;
        properties[item.key] = item.value;
        return;
      }

      properties[item.key] = item.value;
    });

    const entry = {
      name: entryName,
      selector: selectedInfoValue.selector,
      bbox: bbox && typeof bbox !== 'string' ? bbox : undefined,
      properties
    };

    const index = styleEntriesValue.length + 1;
    const variableName = `style_${index}`;

    const codeLine = formatStyleCode(entry, variableName);

    if (!insertDefinitions([codeLine])) {
      return;
    }

    styleName = `Style ${index + 1}`;
  };

  $effect(() => {
    propertyItemsValue;
    setPropertySelectionsFromItems();
  });

  $effect(() => {
    if (!hasSelectionValue) {
      lastSelectedSelector = null;
      styleName = '';
      return;
    }

    if (!selectedInfoValue) {
      return;
    }

    if (selectedInfoValue.selector === lastSelectedSelector) {
      return;
    }

    lastSelectedSelector = selectedInfoValue.selector;
    styleName = `Style ${styleEntriesValue.length + 1}`;
  });
</script>

<div class="flex min-h-0 w-full flex-1 flex-col gap-4 px-4 py-4">
  <div class="flex items-center gap-2">
    <span class="text-label text-gray-600 dark:text-gray-300">Name</span>
    <input
      class="flex-1 rounded-lg bg-gray-100/70 px-3 py-2 text-body text-gray-900 placeholder:text-gray-500 disabled:opacity-60 dark:bg-gray-800/60 dark:text-gray-100"
      type="text"
      value={styleName}
      disabled={!hasSelectionValue}
      oninput={(event) => {
        styleName = event.currentTarget.value;
      }}
    />
    <Button
      class="!p-2"
      variant="secondary"
      onclick={saveStyleDefinition}
      disabled={!hasSelectionValue}
    >
      <Save class="h-4 w-4"/>
    </Button>
  </div>
  <div class="flex-1 min-h-0 overflow-y-auto rounded-lg border border-gray-200/70 bg-gray-100/70 dark:border-gray-700/70 dark:bg-gray-800">
    <div class="grid grid-cols-[max-content_max-content_minmax(0,1fr)]">
      {#each propertyItemsValue as item, index (item.key)}
        {@const inputId = `save-style-prop-${item.key}`}
        <div
          class="flex place-items-center min-h-0 justify-center px-3 py-3 {index > 0 ? 'border-t border-gray-200/70 dark:border-gray-700/70' : ''}"
        >
          <input
            id={inputId}
            class="h-4 w-4 rounded border border-gray-300 bg-transparent accent-accent-500 dark:border-gray-500"
            type="checkbox"
            checked={propertySelections[item.key] ?? false}
            onchange={(event) => {
              propertySelections = {
                ...propertySelections,
                [item.key]: event.currentTarget.checked
              };
            }}
          />
        </div>
        <label
          class="text-caption flex place-items-center justify-end text-right text-gray-700 dark:text-gray-200 px-3 py-3 {index > 0 ? 'border-t border-gray-200/70 dark:border-gray-700/70' : ''}"
          for={inputId}
        >
          {item.label}
        </label>
        <span
          class="text-caption text-gray-600 dark:text-gray-300 px-3 py-3 {index > 0 ? 'border-t border-gray-200/70 dark:border-gray-700/70' : ''}"
        >
          {item.value}
        </span>
      {/each}
    </div>
  </div>
</div>
