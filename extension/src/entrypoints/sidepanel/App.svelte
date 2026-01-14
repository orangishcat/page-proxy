<script lang="ts">
  import {onDestroy, onMount} from 'svelte';
  import {browser} from 'wxt/browser';
  import {CircleQuestionMark, MousePointer, Plus, Share} from 'lucide-svelte';

  import SelectTool from './tools/SelectTool.svelte';
  import NewElementTool from './tools/NewElementTool.svelte';
  import SaveStyleTool from './tools/SaveStyleTool.svelte';
  import ShareTool from './tools/ShareTool.svelte';
  import HelpTool from './tools/HelpTool.svelte';
  import StylesTool from './tools/StylesTool.svelte';
  import CodeEditorTool from './tools/CodeEditorTool.svelte';
  import Button from '@/lib/components/Button.svelte';
  import {attachSelectionListener, sendSelectionToggle} from './tools/select-tool/actions';
  import {errorMessage} from './tools/tool-errors';
  import {
    isSidepanelShortcutMessage,
    type SidepanelShortcutId
  } from '@/lib/sidepanel-shortcuts';

  type ToolId = 'select' | 'new-element' | 'styles' | 'save-style' | 'help' | 'share' | 'none';
  type ToolbarControlId = SidepanelShortcutId;

  const toolLabels: Record<ToolId, string> = {
    select: 'Select',
    'new-element': 'New element',
    styles: 'Styles',
    'save-style': 'Save style',
    share: 'Share',
    help: 'Help',
    none: ''
  };

  let activeTool = $state<ToolId>('none');
  let hoveredTool = $state<ToolbarControlId | null>(null);
  let lastHoveredTool = $state<ToolbarControlId | null>(null);
  let isToolbarHovered = $state(false);
  let errorMessageValue = $state<string | null>(null);

  const unsubscribeErrorMessage = errorMessage.subscribe((value) => {
    errorMessageValue = value;
  });

  const activeToolLabel = $derived(toolLabels[activeTool]);
  const shortcutLabels: Record<ToolbarControlId, string> = {
    select: '⇧1',
    'new-element': '⇧2',
    styles: '⇧3',
    help: '⇧4',
    share: '⇧5'
  };
  const hoverCandidate = $derived(hoveredTool ?? lastHoveredTool);
  const hoveredShortcutLabel = $derived(hoverCandidate ? shortcutLabels[hoverCandidate] : '');
  const hoveredToolLabel = $derived(hoverCandidate ? toolLabels[hoverCandidate] : '');
  const hoveredToolText = $derived(
    hoverCandidate
      ? `${hoveredToolLabel} (${hoveredShortcutLabel})`
      : ''
  );
  const showHoveredToolLabel = $derived(Boolean(isToolbarHovered && hoverCandidate));
  const toolLabelText = $derived(showHoveredToolLabel ? hoveredToolText : activeToolLabel);
  const isSelectToolActive = $derived(activeTool === 'select');

  const setActiveTool = (tool: ToolId) => {
    const wasSelectTool = activeTool === 'select';
    activeTool = tool;
    const isSelectTool = tool === 'select';
    if (wasSelectTool !== isSelectTool) {
      sendSelectionToggle(isSelectTool);
    }
  };

  const activateSelectTool = () => {
    if (activeTool === 'select') {
      sendSelectionToggle(true);
      return;
    }

    setActiveTool('select');
  };

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return false;
    }

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return true;
    }

    if (target instanceof HTMLElement && target.isContentEditable) {
      return true;
    }

    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable]'));
  };

  const getShortcutTool = (event: KeyboardEvent): ToolbarControlId | null => {
    if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return null;
    }

    switch (event.code) {
      case 'Digit1':
        return 'select';
      case 'Digit2':
        return 'new-element';
      case 'Digit3':
        return 'styles';
      case 'Digit4':
        return 'help';
      case 'Digit5':
        return 'share';
      default:
        return null;
    }
  };

  const handleShortcut = (tool: ToolbarControlId) => {
    if (tool === 'select') {
      activateSelectTool();
      return;
    }

    if (tool === 'share') {
      setActiveTool('share');
      return;
    }

    setActiveTool(tool === 'help' ? 'help' : tool);
  };

  onMount(() => {
    const cleanup = attachSelectionListener();

    const handleRuntimeMessage = (message: unknown) => {
      if (!isSidepanelShortcutMessage(message)) {
        return;
      }

      handleShortcut(message.payload.tool);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) {
        return;
      }

      const tool = getShortcutTool(event);
      if (!tool) {
        return;
      }

      handleShortcut(tool);
    };

    window.addEventListener('keydown', onKeyDown, {capture: true});
    browser.runtime.onMessage.addListener(handleRuntimeMessage);

    return () => {
      cleanup();
      window.removeEventListener('keydown', onKeyDown, {capture: true});
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  });

  onDestroy(() => {
    unsubscribeErrorMessage();
  });

  const toolButtonClasses = (selected: boolean) => 'w-8 h-8 !p-0 rounded-lg text-white dark:text-white ' +
    (selected ? 'bg-accent-500 hover:!opacity-100' : 'bg-[#55503E] hover:opacity-55 active:opacity-40');
  const iconSize = 'w-5 h-5';
</script>

<main class="flex h-full w-full overflow-hidden bg-[#222121] text-white">
  <div class="relative h-full w-full min-w-full">
    <div class="flex h-full w-full flex-col">
      <section
        class="relative flex flex-col h-[36.56%] w-full bg-[#282824] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
        aria-label="Tool panel"
      >
        <div
          class="flex justify-between h-14 px-3 py-2 bg-[#393a34]"
          role="toolbar"
          aria-label="Tool actions"
          tabindex="0"
          onmouseenter={() => {
            isToolbarHovered = true;
          }}
          onmouseleave={() => {
            isToolbarHovered = false;
            hoveredTool = null;
            lastHoveredTool = null;
          }}
        >
          <!-- Left side -->
          <div class="h-full min-w-0 flex flex-1 flex-row gap-3 place-items-center">
            <Button
              class={toolButtonClasses(activeTool === 'select')}
              variant="outline"
              aria-label="Toggle selection mode"
              aria-pressed={isSelectToolActive}
              onmouseenter={() => {
                hoveredTool = 'select';
                lastHoveredTool = 'select';
              }}
              onmouseleave={() => {
                hoveredTool = null;
              }}
              onclick={activateSelectTool}
            >
              <MousePointer class={iconSize}/>
            </Button>
            <Button
              class={toolButtonClasses(activeTool === 'new-element')}
              variant="outline"
              aria-label="New element tool"
              onmouseenter={() => {
                hoveredTool = 'new-element';
                lastHoveredTool = 'new-element';
              }}
              onmouseleave={() => {
                hoveredTool = null;
              }}
              onclick={() => setActiveTool('new-element')}
            >
              <Plus class={iconSize}/>
            </Button>
            <Button
              class="{toolButtonClasses(activeTool === 'styles')} text-sm"
              variant="outline"
              aria-label="Styles tool"
              onmouseenter={() => {
                hoveredTool = 'styles';
                lastHoveredTool = 'styles';
              }}
              onmouseleave={() => {
                hoveredTool = null;
              }}
              onclick={() => setActiveTool('styles')}
            >
              $0
            </Button>
            <span class="min-w-0 max-w-full flex-1 truncate transition duration-300 {showHoveredToolLabel ? 'text-gray-600 dark:text-gray-400' : ''}">
              {toolLabelText}
            </span>
          </div>
          <!-- Right side -->
          <div class="h-full flex flex-row gap-4 place-items-center">
            <Button
              class={toolButtonClasses(activeTool === 'help')}
              variant="outline"
              aria-label="Help"
              onmouseenter={() => {
                hoveredTool = 'help';
                lastHoveredTool = 'help';
              }}
              onmouseleave={() => {
                hoveredTool = null;
              }}
              onclick={() => setActiveTool('help')}
            >
              <CircleQuestionMark class={iconSize}/>
            </Button>
            <Button
              class={toolButtonClasses(activeTool === 'share')}
              variant="secondary"
              aria-label="Share tool"
              onmouseenter={() => {
                hoveredTool = 'share';
                lastHoveredTool = 'share';
              }}
              onmouseleave={() => {
                hoveredTool = null;
              }}
              onclick={() => setActiveTool('share')}
            >
              <Share class={iconSize}/>
            </Button>
          </div>
        </div>

        {#if activeTool === 'select'}
          <SelectTool
            onSaveToStyles={() => setActiveTool('save-style')}
          />
        {:else if activeTool === 'new-element'}
          <NewElementTool />
        {:else if activeTool === 'styles'}
          <StylesTool />
        {:else if activeTool === 'save-style'}
          <SaveStyleTool />
        {:else if activeTool === 'help'}
          <HelpTool />
        {:else if activeTool === 'share'}
          <ShareTool />
        {:else if activeTool === 'none'}
          <div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4 justify-center place-items-center">
            <p class="text-caption text-gray-500 dark:text-gray-400">
              Select a tool from the top bar
            </p>
          </div>
        {:else}
          <div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4">
            <p class="text-body">
              Unknown tool: {activeTool}
            </p>
          </div>
        {/if}
      </section>

      <CodeEditorTool />
    </div>

    {#if errorMessageValue}
      <div class="absolute bottom-0 left-0 w-full bg-[#3b1d1d] px-[4%] py-[2%] text-caption text-[#f5b1b1]">
        {errorMessageValue}
      </div>
    {/if}
  </div>
</main>
