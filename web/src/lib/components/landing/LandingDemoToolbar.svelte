<script lang="ts">
  import { CircleQuestionMark, MousePointer, Plus, Share } from "lucide-svelte";
  import Button from "$lib/components/Button.svelte";

  type Props = {
    title: string;
    isPointerSelected?: boolean;
  };

  let { title, isPointerSelected = false }: Props = $props();

  const pointerButtonClasses = $derived(
    `h-9! w-9! rounded-lg p-0! text-white! hover:opacity-55 ${
      isPointerSelected ? "bg-accent-500!" : "bg-gray-700!"
    }`,
  );

  const toolButtonClasses = "h-9! w-9! rounded-lg bg-gray-700! p-0! text-white! hover:opacity-55";
  const exportButtonClasses = "h-9! w-9! rounded-lg bg-secondary-500! p-0! text-white! hover:opacity-55";
  const selectorButtonClasses = `${toolButtonClasses} text-sm`;
</script>

<div class="flex h-12 items-center justify-between bg-gray-800 px-3 py-2">
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <Button class={pointerButtonClasses} variant="outline" aria-label="Toggle selection mode">
      <MousePointer class="h-5 w-5" />
    </Button>
    <Button class={toolButtonClasses} variant="outline" aria-label="Create tool">
      <Plus class="h-5 w-5" />
    </Button>
    <Button class={selectorButtonClasses} variant="outline" aria-label="Selectors tool">
      $0
    </Button>
    <span class="truncate text-sm text-gray-100">{title}</span>
  </div>

  <div class="flex items-center gap-3.5">
    <Button class={toolButtonClasses} variant="outline" aria-label="Help">
      <CircleQuestionMark class="h-5 w-5" />
    </Button>
    <Button class={exportButtonClasses} variant="outline" aria-label="Export tool">
      <Share class="h-5 w-5" />
    </Button>
  </div>
</div>
