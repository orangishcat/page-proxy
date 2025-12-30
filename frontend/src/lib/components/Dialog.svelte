<script lang="ts">
  import { Dialog } from 'bits-ui';

  export let title = 'Test dialog';
  export let description =
    'This is a cool dialog.';
  export let triggerLabel = 'Open dialog';
</script>

<Dialog.Root>
  <Dialog.Trigger
    class="text-button rounded-2xl border border-accent-500 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary-600 to-primary-400 px-5 py-2 text-gray-700 hover:brightness-110 active:brightness-95 dark:text-gray-100"
  >
    {triggerLabel}
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm dark:bg-gray-950/70" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-gray-300 bg-gray-200 p-6 text-gray-700 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
    >
      <div class="grid gap-3">
        <Dialog.Title class="text-title">{title}</Dialog.Title>
        <Dialog.Description class="text-body text-gray-500 dark:text-gray-200">
          {description}
        </Dialog.Description>
      </div>
      <div class="mt-6 flex justify-end gap-3">
        <Dialog.Close
          class="rounded-2xl border border-accent-500 bg-transparent px-4 py-2 text-button text-gray-700 hover:bg-gray-300 hover:opacity-100 active:opacity-100 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          Close
        </Dialog.Close>
        <Dialog.Close
          class="rounded-2xl border border-accent-500 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary-600 to-primary-400 px-4 py-2 text-button text-gray-700 hover:brightness-110 active:brightness-95 dark:text-gray-100"
        >
          Confirm
        </Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
