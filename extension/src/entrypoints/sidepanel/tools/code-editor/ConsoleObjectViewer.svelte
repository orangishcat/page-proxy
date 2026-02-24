<script lang="ts">
  import type { ScriptRunLogValue } from "@/lib/script-runner";
  import StackTraceView from "../StackTraceView.svelte";
  import Self from "./ConsoleObjectViewer.svelte";

  type Props = {
    value: ScriptRunLogValue;
    propertyName?: string;
  };

  let { value, propertyName = undefined }: Props = $props();

  const isExpandable = (current: ScriptRunLogValue) =>
    current.kind === "array" || current.kind === "object" || current.kind === "error";

  const getLabelPrefix = (key?: string) => (key ? `${key}: ` : "");

  const renderInline = (current: ScriptRunLogValue): string => {
    switch (current.kind) {
      case "null":
        return "null";
      case "undefined":
        return "undefined";
      case "string":
        return JSON.stringify(current.value);
      case "number":
        return String(current.value);
      case "boolean":
        return current.value ? "true" : "false";
      case "bigint":
        return `${current.value}n`;
      case "symbol":
        return current.value;
      case "function":
        return `[Function ${current.name}]`;
      case "date":
        return `Date(${current.value})`;
      case "regexp":
        return current.value;
      case "accessor":
        return current.description;
      case "circular":
        return "[Circular]";
      case "array":
        return `Array(${current.items.length}${current.truncated ? "+" : ""})`;
      case "object":
        return `${current.constructorName ?? "Object"} {${current.entries.length}${current.truncated ? "+" : ""}}`;
      case "error":
        return `${current.name}: ${current.message}`;
      default:
        return "";
    }
  };

  const getSummaryLabel = (current: ScriptRunLogValue) => {
    if (current.kind === "array") {
      return `Array(${current.items.length}${current.truncated ? "+" : ""})`;
    }
    if (current.kind === "object") {
      const base = current.constructorName ?? "Object";
      return `${base} {${current.entries.length}${current.truncated ? "+" : ""}}`;
    }
    if (current.kind === "error") {
      return `${current.name}: ${current.message}`;
    }
    return renderInline(current);
  };

  const asStringValue = (text: string): ScriptRunLogValue => ({
    kind: "string",
    value: text,
  });
</script>

{#if isExpandable(value)}
  <details class="rounded-sm open:bg-black/20">
    <summary class="cursor-pointer select-none text-[#d7d8d3]">
      <span class="text-[#a7a99d]">{getLabelPrefix(propertyName)}</span>{getSummaryLabel(value)}
    </summary>
    <div class="ml-3 mt-1 border-l border-white/10 pl-2">
      {#if value.kind === "array"}
        {#each value.items as item, index (`${index}`)}
          <div class="py-0.5">
            <Self value={item} propertyName={`${index}`} />
          </div>
        {/each}
        {#if value.truncated}
          <div class="py-0.5 text-[#9b9f90]">…more items</div>
        {/if}
      {:else if value.kind === "object"}
        {#each value.entries as entry (`${entry.key}`)}
          <div class="py-0.5">
            <Self value={entry.value} propertyName={entry.key} />
          </div>
        {/each}
        {#if value.truncated}
          <div class="py-0.5 text-[#9b9f90]">…more properties</div>
        {/if}
      {:else if value.kind === "error"}
        <div class="py-0.5">
          <Self value={asStringValue(value.name)} propertyName="name" />
        </div>
        <div class="py-0.5">
          <Self value={asStringValue(value.message)} propertyName="message" />
        </div>
        {#if value.stack}
          <div class="py-0.5">
            <StackTraceView stackTrace={value.stack} />
          </div>
        {/if}
      {/if}
    </div>
  </details>
{:else}
  <div class="text-[#d7d8d3]">
    <span class="text-[#a7a99d]">{getLabelPrefix(propertyName)}</span>{renderInline(value)}
  </div>
{/if}
