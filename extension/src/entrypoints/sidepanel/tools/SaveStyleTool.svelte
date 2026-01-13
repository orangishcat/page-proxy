<script lang="ts">
  import {onDestroy} from 'svelte';
  import Button from '@/lib/components/Button.svelte';
  import type {ElementInfo} from '@/lib/selection';
  import type {StyleEntry} from './code-editor/state';
  import type {PropertyItem} from './select-tool/state';
  import {hasSelection, propertyItems, selectedInfo} from './select-tool/state';
  import {
    buildDefinitionComment,
    formatStyleCode,
    insertDefinitions,
    styleEntries
  } from './code-editor/state';
  import {setErrorMessage} from './tool-errors';

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

    const commentLine = buildDefinitionComment(
      'style',
      entry.name,
      entry.selector,
      entry.bbox ?? null,
      entry.properties,
      'prop'
    );

    const codeLine = formatStyleCode(entry, variableName);

    if (!insertDefinitions([commentLine, codeLine])) {
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

<div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4">
  <div class="flex flex-wrap items-center gap-3">
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
      class="min-w-24"
      variant="primary"
      onclick={saveStyleDefinition}
      disabled={!hasSelectionValue}
    >
      Save
    </Button>
  </div>
  <div class="flex-1 overflow-y-auto rounded-lg border border-gray-200/70 dark:border-gray-700/70">
    <div class="divide-y divide-gray-200/70 dark:divide-gray-700/70">
      {#each propertyItemsValue as item (item.key)}
        <div class="flex items-center justify-between gap-4 bg-gray-100/70 px-3 py-3 dark:bg-gray-800">
          <label class="flex items-center gap-3">
            <input
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
            <span class="text-caption text-gray-700 dark:text-gray-200">{item.label}</span>
          </label>
          <span class="text-caption text-gray-600 dark:text-gray-300">{item.value}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
