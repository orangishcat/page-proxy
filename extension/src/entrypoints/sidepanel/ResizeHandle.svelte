<script lang="ts">
  type Props = {
    onheightchange: (clientY: number) => void;
    onresizefinish: (clientY: number) => void;
  };

  const { onheightchange, onresizefinish }: Props = $props();

  let el = $state<HTMLDivElement | null>(null);
  let pointerId = $state<number | null>(null);
  let isResizing = $state(false);

  const start = (event: PointerEvent) => {
    if (event.button !== 0 || !el) return;
    event.preventDefault();
    pointerId = event.pointerId;
    isResizing = true;
    el.setPointerCapture(event.pointerId);
    onheightchange(event.clientY);
  };

  const move = (event: PointerEvent) => {
    if (!isResizing || event.pointerId !== pointerId) return;
    event.preventDefault();
    onheightchange(event.clientY);
  };

  const finish = (event: PointerEvent) => {
    if (event.pointerId !== pointerId || !el) return;
    if (el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    isResizing = false;
    pointerId = null;
    onresizefinish(event.clientY);
  };
</script>

<div
  class="h-2 w-full shrink-0 cursor-row-resize bg-[#282824] transition-colors hover:bg-[#4a4b45] active:bg-accent-500/40"
  role="separator"
  aria-label="Resize tool panel"
  aria-orientation="horizontal"
  bind:this={el}
  onpointerdown={start}
  onpointermove={move}
  onpointerup={finish}
  onpointercancel={finish}
></div>
