<script lang="ts">
  import {onDestroy} from 'svelte';
  import Button from '@/lib/components/Button.svelte';
  import type {ScriptMetadataState} from './code-editor/state';
  import {scriptMetadata} from './code-editor/state';

  let scriptMetadataValue = $state<ScriptMetadataState>({
    title: 'Page Proxy',
    website: '',
    description: ''
  });

  const unsubscribeScriptMetadata = scriptMetadata.subscribe((value) => {
    scriptMetadataValue = value;
  });

  onDestroy(() => {
    unsubscribeScriptMetadata();
  });
</script>

<div class="flex w-full min-h-0 flex-1 flex-col px-4 py-4">
  <div class="min-h-0 flex-1 space-y-2 overflow-y-auto">
    <span class="text-subtitle text-gray-900 dark:text-gray-100">{scriptMetadataValue.title}</span>
    {#if scriptMetadataValue.website}
      <div class="text-caption text-gray-600 dark:text-gray-300">
        Applies to <span class="text-gray-800 underline dark:text-gray-100">{scriptMetadataValue.website}</span>
      </div>
    {/if}
    {#if scriptMetadataValue.description}
      <p class="text-body text-gray-700 dark:text-gray-200">{scriptMetadataValue.description}</p>
    {/if}
  </div>
  <div class="flex h-12 items-center justify-center">
    <Button class="w-full max-w-xs" variant="secondary" disabled>
      Publish
    </Button>
  </div>
</div>
