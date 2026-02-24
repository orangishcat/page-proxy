<script lang="ts">
  type Props = {
    stackTrace: string;
    label?: string;
  };

  let {stackTrace, label = "Stack trace"}: Props = $props();
</script>

<details class="mt-2 rounded border border-white/10 bg-black/20 p-2">
  <summary class="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide opacity-90">{label}</summary>
  <pre
    class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-black/25 p-2 font-mono text-xs leading-5 opacity-95"
  >{stackTrace}</pre>
</details>
