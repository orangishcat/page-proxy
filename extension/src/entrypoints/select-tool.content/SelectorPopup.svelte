<script lang="ts">
  import type { ElementInfo, SelectorRuleFilters } from "@/lib/selection";
  import log from "loglevel";

  type PropertyItem = {
    key: string;
    label: string;
    value: string;
    rawValue: string | ElementInfo["boundingBox"];
    primary: boolean;
  };

  type OperatorType = "contains" | "matches" | "exists";

  type FilterRule = {
    id: string;
    propertyKey: string;
    operator: OperatorType;
    value: string;
  };

  type Props = {
    info: ElementInfo;
    propertyItems: PropertyItem[];
    onSave: (name: string, rules: SelectorRuleFilters) => void;
    onCancel: () => void;
  };

  let { info: _info, propertyItems, onSave, onCancel }: Props = $props();
  let logger = log.getLogger("SelectorPopup");
  logger.setLevel(log.levels.TRACE);

  let styleName = $state("Style 1");
  let filterRules = $state<FilterRule[]>([]);
  let errorMessage = $state("");
  let ruleIdCounter = 0;

  const propertyMap = $derived(new Map(propertyItems.map((item) => [item.key, item])));
  const usedKeys = $derived(new Set(filterRules.map((r) => r.propertyKey)));
  const availableItems = $derived(propertyItems.filter((item) => !usedKeys.has(item.key)));

  const generateRuleId = () => {
    ruleIdCounter += 1;
    return `rule-${ruleIdCounter}-${Date.now()}`;
  };

  const getOperatorsForProperty = (key: string): OperatorType[] => {
    if (key === "selector") return ["matches"];
    return ["contains", "matches", "exists"];
  };

  const addRule = (key: string, value: string) => {
    const operators = getOperatorsForProperty(key);
    filterRules = [...filterRules, { id: generateRuleId(), propertyKey: key, operator: operators[0], value }];
    errorMessage = "";
  };

  const removeRule = (id: string) => {
    filterRules = filterRules.filter((r) => r.id !== id);
    errorMessage = "";
  };

  const updateOperator = (id: string, operator: OperatorType) => {
    filterRules = filterRules.map((r) => (r.id === id ? { ...r, operator } : r));
  };

  const cycleProperty = (id: string) => {
    const rule = filterRules.find((r) => r.id === id);
    if (!rule) return;
    const allKeys = Array.from(propertyMap.keys());
    const nextIndex = (allKeys.indexOf(rule.propertyKey) + 1) % allKeys.length;
    const newKey = allKeys[nextIndex];
    if (!newKey) return;
    const newProp = propertyMap.get(newKey);
    const operators = getOperatorsForProperty(newKey);
    filterRules = filterRules.map((r) =>
      r.id === id
        ? {
            ...r,
            propertyKey: newKey,
            value: newProp?.value || "",
            operator: operators.includes(r.operator) ? r.operator : operators[0],
          }
        : r,
    );
  };

  const handleSave = () => {
    if (filterRules.length === 0) {
      errorMessage = "Add at least one rule to save a selector.";
      return;
    }
    const rules: SelectorRuleFilters = { contains: {}, matches: {}, keyOnly: [] };
    for (const rule of filterRules) {
      if (rule.operator === "contains") rules.contains[rule.propertyKey] = rule.value;
      else if (rule.operator === "matches") rules.matches[rule.propertyKey] = rule.value;
      else rules.keyOnly.push(rule.propertyKey);
    }
    onSave(styleName.trim() || "Style 1", rules);
  };

  const handleDragStart = (e: DragEvent, key: string, value: string) => {
    logger.debug(`Drag start for ${key}:${value}`);
    e.dataTransfer?.setData("application/x-property", `${key}\x01${value}`);
    e.dataTransfer!.effectAllowed = "copy";
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer?.getData("application/x-property");
    if (!data) return;
    const [key, value] = data.split("\x01");
    if (key && !usedKeys.has(key)) addRule(key, value || "");
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
  };

  const truncate = (val: string, max: number) => (val.length > max ? `${val.slice(0, max)}…` : val);
</script>

<div
  class="flex flex-col w-full h-full overflow-hidden rounded-lg border border-gray-800 bg-gray-950 text-gray-100 font-sans text-sm shadow-2xl darkreader"
>
  <!-- Header -->
  <div class="flex items-center h-12 px-4 gap-2.5 bg-gray-900 border-b border-gray-800">
    <span class="text-base font-normal text-gray-500">Selector rules for </span>
    <input
      type="text"
      bind:value={styleName}
      placeholder="Style 1"
      class="border-none bg-transparent text-white text-xl font-medium p-0 m-0 min-w-16 max-w-48 outline-none focus:border-b focus:border-accent-500"
    />
    <div class="flex-1"></div>
    <button
      type="button"
      onclick={onCancel}
      class="p-1 rounded text-gray-500 hover:bg-white/10 hover:text-white"
      aria-label="Close popup">×</button
    >
  </div>

  <!-- Body -->
  <div class="flex flex-1 min-h-0 overflow-hidden">
    <!-- Rules panel -->
    <div class="flex flex-col flex-1 min-w-0 p-3" ondrop={handleDrop} ondragover={handleDragOver} role="list">
      <div class="flex flex-col gap-4 min-h-0 h-full overflow-y-auto">
        {#if filterRules.length === 0}
          <div class="p-6 h-full">
            <div
              class="text-sm text-gray-500 text-center border border-dashed border-gray-700 rounded-lg h-full flex items-center justify-center"
            >
              Drag properties here to create filter rules
            </div>
          </div>
        {:else}
          {#each filterRules as rule (rule.id)}
            <div class="flex items-center gap-4 py-2 px-5 rounded-lg bg-gray-900 border border-gray-800">
              <button
                type="button"
                onclick={() => cycleProperty(rule.id)}
                class="font-mono text-base font-medium text-white bg-transparent border-none py-1 px-2 rounded cursor-pointer min-w-20 hover:bg-white/10"
                >{rule.propertyKey}</button
              >
              <select
                value={rule.operator}
                onchange={(e) => updateOperator(rule.id, e.currentTarget.value as OperatorType)}
                class="text-sm text-white bg-white/10 border border-white/15 py-1 px-2 rounded cursor-pointer min-w-22"
              >
                {#each getOperatorsForProperty(rule.propertyKey) as op}
                  <option value={op}>{op}</option>
                {/each}
              </select>
              <div class="flex-1 font-mono text-xs text-gray-400 text-right truncate" title={rule.value}>
                {rule.operator === "exists" ? "(key exists)" : truncate(rule.value, 30)}
              </div>
              <button
                type="button"
                onclick={() => removeRule(rule.id)}
                class="p-1 text-gray-500 hover:bg-white/10 hover:text-white rounded"
                aria-label="Remove {rule.propertyKey} rule">×</button
              >
            </div>
          {/each}
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex flex-col place-items-center">
        <div class="flex gap-2 p-3 border-t border-gray-800 bg-gray-950">
          <button
            type="button"
            onclick={handleSave}
            class="flex-1 rounded-md py-2 px-4 text-sm font-medium bg-accent-500 text-gray-950 hover:bg-accent-400 transition-colors"
            >Save</button
          >
          <button
            type="button"
            onclick={onCancel}
            class="flex-1 rounded-md py-2 px-4 text-sm font-medium bg-transparent text-gray-100 border border-white/20 hover:bg-white/10 transition-colors"
            >Cancel</button
          >
        </div>

        <!-- Error -->
        {#if errorMessage}
          <div class="text-xs text-red-400 px-3 py-1">{errorMessage}</div>
        {/if}
      </div>
    </div>

    <!-- Properties panel -->
    <div class="flex flex-col w-64 max-w-64 min-w-0 border-l border-gray-800 bg-black/20 overflow-y-auto p-3">
      <div class="flex flex-col gap-2 items-center">
        {#each availableItems as item (item.key)}
          <div
            class="flex justify-between items-center cursor-grab group w-full"
            draggable="true"
            role="listitem"
            ondragstart={(e) => handleDragStart(e, item.key, item.value)}
          >
            <div class="font-mono text-xs text-accent-500 group-hover:brightness-125 transition-[filter]">
              {item.key}
            </div>
            <div
              class="font-mono text-xs text-secondary-500 truncate group-hover:brightness-125 transition-[filter] text-right"
              class:underline={item.value.length > 18}
              class:cursor-help={item.value.length > 18}
              title={item.value.length > 18 ? item.value : undefined}
            >
              {item.value.length > 18 ? `${item.value.length} chars` : item.value}
            </div>
          </div>
        {/each}
        {#if availableItems.length === 0}
          <div class="col-span-full text-xs text-gray-500 text-center p-4">All properties used in rules.</div>
        {/if}
      </div>
    </div>
  </div>
</div>
