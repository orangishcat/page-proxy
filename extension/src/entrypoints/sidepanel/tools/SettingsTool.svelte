<script lang="ts">
  import { Switch } from "bits-ui";
  import { getEditorContext } from "../context/editor.svelte";
  import { getToolContext } from "../context/tool.svelte";
  import { readStoredScriptEnabled, saveStoredScriptEnabled } from "./state-storage";
  import type { ScriptSelectionOption } from "./code-editor/state";
  import { setToolMessage } from "./tool-errors";
  import { saveShowHelpButtonSetting } from "@/lib/show-help-button-setting";
  import log from "@/lib/logger";

  const logger = log.getLogger("settings tool");

  type ScriptSettingEntry = ScriptSelectionOption & {
    enabled: boolean;
    isSaving: boolean;
  };

  const editorCtx = getEditorContext();
  const toolCtx = getToolContext();

  let scriptSettings = $state<ScriptSettingEntry[]>([]);
  let isLoadingScriptSettings = $state(false);
  let loadRequestId = 0;

  const switchClasses =
    "group inline-flex h-6 w-9 shrink-0 items-center rounded-full border border-gray-700 bg-gray-900 p-0.25 cursor-pointer transition data-[state=checked]:border-transparent data-[state=checked]:bg-accent-600 data-[disabled]:opacity-60";
  const switchThumbClasses =
    "block size-4 rounded-full bg-gray-200 transition-transform data-[state=checked]:translate-x-[90%]";

  const updateScriptSettings = (scriptName: string, updater: (entry: ScriptSettingEntry) => ScriptSettingEntry) => {
    scriptSettings = scriptSettings.map((entry) => (entry.scriptName === scriptName ? updater(entry) : entry));
  };

  $effect(() => {
    const scriptOptions = editorCtx.scriptOptions;
    const requestId = ++loadRequestId;

    if (scriptOptions.length === 0) {
      isLoadingScriptSettings = false;
      scriptSettings = [];
      return;
    }

    isLoadingScriptSettings = true;
    scriptSettings = scriptOptions.map((option) => ({
      ...option,
      enabled: true,
      isSaving: false,
    }));

    void Promise.all(
      scriptOptions.map(async (option) => ({
        ...option,
        enabled: await readStoredScriptEnabled(option.scriptName),
        isSaving: false,
      })),
    )
      .then((entries) => {
        if (requestId !== loadRequestId) {
          return;
        }

        scriptSettings = entries;
        isLoadingScriptSettings = false;
      })
      .catch(() => {
        if (requestId !== loadRequestId) {
          return;
        }

        isLoadingScriptSettings = false;
        setToolMessage("Unable to load script settings.", "error");
      });
  });

  const toggleScriptEnabled = (scriptName: string) => {
    const currentEntry = scriptSettings.find((entry) => entry.scriptName === scriptName);
    if (!currentEntry || currentEntry.isSaving) {
      return;
    }

    const nextEnabled = !currentEntry.enabled;
    updateScriptSettings(scriptName, (entry) => ({ ...entry, enabled: nextEnabled, isSaving: true }));

    void saveStoredScriptEnabled(scriptName, nextEnabled)
      .then(() => {
        updateScriptSettings(scriptName, (entry) => ({ ...entry, isSaving: false }));
        setToolMessage(null, "error");
      })
      .catch(() => {
        updateScriptSettings(scriptName, (entry) => ({ ...entry, enabled: !nextEnabled, isSaving: false }));
        setToolMessage("Unable to update script settings.", "error");
      });
  };

  $effect(() => {
    logger.debug("show help button setting:", toolCtx.showHelpButton);
    if (toolCtx.showHelpButton === undefined) {
      return;
    }
    void saveShowHelpButtonSetting(toolCtx.showHelpButton)
      .then(() => {
        setToolMessage(null, "error");
      })
      .catch(() => {
        setToolMessage("Unable to update extension settings.", "error");
      });
  });
</script>

<div class="px-4 py-4 overflow-auto space-y-4">
  <section class="flex min-h-0 flex-1 flex-col gap-1.5">
    {#if isLoadingScriptSettings}
      <div class="flex min-h-0 flex-1 items-center justify-center text-body text-gray-500 dark:text-gray-400">
        Loading script settings…
      </div>
    {:else if scriptSettings.length === 0}
      <div class="flex min-h-0 flex-1 items-center justify-center text-body text-gray-500 dark:text-gray-400">
        It&apos;s empty in here
      </div>
    {:else}
      <div class="rounded-lg border border-gray-700 bg-background-overlay text-gray-100 overflow-hidden">
        {#each scriptSettings as entry (entry.scriptName)}
          <button
            class="flex w-full items-center justify-between gap-3 px-3 py-2 hover:bg-background-overlay-hover cursor-pointer"
            onclick={() => toggleScriptEnabled(entry.scriptName)}
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span
                  class="truncate text-sm text-accent-500"
                  class:text-accent-500={editorCtx.activeScriptName === entry.scriptName}>{entry.scriptName}</span
                >
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-caption text-gray-500">
                {entry.enabled ? "grants on" : "grants off"}
              </span>
              <Switch.Root
                checked={entry.enabled}
                disabled={entry.isSaving}
                aria-label={`${entry.enabled ? "Disable" : "Enable"} grants for ${entry.scriptName}`}
                class={switchClasses}
              >
                <Switch.Thumb class={switchThumbClasses} />
              </Switch.Root>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </section>
  <section class="rounded-lg border border-gray-700 bg-background-overlay overflow-hidden">
    <button
      class="flex items-center justify-between w-full gap-3 hover:bg-background-overlay-hover px-3 py-2 text-gray-100 select-none cursor-pointer"
      onclick={() => (toolCtx.showHelpButton = !toolCtx.showHelpButton)}
    >
      <div class="min-w-0">
        <span class="text-sm">Show help tool</span>
      </div>
      <Switch.Root checked={toolCtx.showHelpButton} class={switchClasses}>
        <Switch.Thumb class={switchThumbClasses} />
      </Switch.Root>
    </button>
  </section>
</div>
