<script lang="ts">
  import {createEventDispatcher} from 'svelte';
  import {Dialog} from 'bits-ui';

  type NewFileDetails = {
    title: string;
    website: string;
    description: string;
  };

  type Props = {
    open?: boolean;
  };

  let {open = $bindable(false)}: Props = $props();

  const dispatch = createEventDispatcher<{submit: NewFileDetails}>();
  let title = $state('');
  let website = $state('');
  let description = $state('');
  let attemptedSubmit = $state(false);
  let touched = $state({title: false, website: false});

  const titleValue = () => title.trim();
  const websiteValue = () => website.trim();

  const isValidWebsite = () => {
    const value = websiteValue();
    if (!value) {
      return false;
    }
    if (!value.includes('.')) {
      return false;
    }
    if (typeof URL !== 'undefined' && 'canParse' in URL) {
      return URL.canParse(value);
    }
    return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value);
  };

  const isTitleValid = () => titleValue().length > 0;
  const isFormValid = () => isTitleValid() && isValidWebsite();

  const resetForm = () => {
    title = '';
    website = '';
    description = '';
    attemptedSubmit = false;
    touched = {title: false, website: false};
  };

  const dispatchSubmit = () => {
    if (!isFormValid()) {
      attemptedSubmit = true;
      return;
    }
    const detail: NewFileDetails = {
      title: titleValue(),
      website: websiteValue(),
      description: description.trim()
    };

    resetForm();
    dispatch('submit', detail);
    open = false;
  };

  $effect(() => {
    if (!open) {
      resetForm();
    }
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm dark:bg-gray-950/70" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-300 bg-gray-300 p-6 text-gray-700 shadow-2xl will-change-[transform,opacity] data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out dark:border-gray-700 dark:bg-gray-850 dark:text-gray-100"
    >
      <div class="grid gap-2">
        <Dialog.Title class="text-title">New Project</Dialog.Title>
        <Dialog.Description class="text-body text-gray-500 dark:text-gray-200">
          Add a project title, the website you want to modify, and an optional description.
        </Dialog.Description>
      </div>

      <form
        class="mt-6 grid gap-4"
        onsubmit={(event) => {
          event.preventDefault();
          dispatchSubmit();
        }}
        novalidate
      >
        <label class="grid gap-2">
          <span class="flex items-center justify-between gap-4">
            <span class="text-label text-gray-600 dark:text-gray-300">Title</span>
            {#if (attemptedSubmit || touched.title) && !isTitleValid()}
              <span class="text-caption text-red-600 dark:text-red-400">Title is required.</span>
            {/if}
          </span>
          <input
            class="h-10 rounded-xl border border-gray-300 bg-white px-3 text-body text-gray-700 shadow-sm outline-none ring-0 transition focus:border-accent-500 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            type="text"
            name="title"
            placeholder="Steam redesign"
            bind:value={title}
            required
            aria-invalid={(attemptedSubmit || touched.title) && !isTitleValid()}
            onblur={() => {
              touched = {...touched, title: true};
            }}
          />
        </label>

        <label class="grid gap-2">
          <span class="flex items-center justify-between gap-4">
            <span class="text-label text-gray-600 dark:text-gray-300">Website</span>
            {#if (attemptedSubmit || touched.website) && !isValidWebsite()}
              <span class="text-caption text-red-600 dark:text-red-400">Invalid URL</span>
            {/if}
          </span>
          <input
            class="h-10 rounded-xl border border-gray-300 bg-white px-3 text-body text-gray-700 shadow-sm outline-none ring-0 transition focus:border-accent-500 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            type="url"
            name="website"
            placeholder="https://store.steampowered.com/"
            bind:value={website}
            required
            aria-invalid={(attemptedSubmit || touched.website) && !isValidWebsite()}
            onblur={() => {
              touched = {...touched, website: true};
            }}
          />
        </label>

        <label class="grid gap-2">
          <span class="text-label text-gray-600 dark:text-gray-300">Description</span>
          <textarea
            class="min-h-24 rounded-xl border border-gray-300 bg-white px-3 py-2 text-body text-gray-700 shadow-sm outline-none ring-0 transition focus:border-accent-500 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            name="description"
            placeholder="Steam's UI is ugly, so I fixed it!"
            bind:value={description}
          ></textarea>
        </label>

        <div class="mt-2 flex items-center justify-end gap-4">
          <Dialog.Close
            class="rounded-lg border border-secondary-500/65 bg-transparent px-4 py-1.5 text-button text-gray-700 hover:bg-gray-300 hover:opacity-100 active:opacity-100 dark:text-gray-100 dark:hover:bg-gray-600"
            onclick={resetForm}
            type="button"
          >
            Cancel
          </Dialog.Close>
          <button
            class="rounded-lg border border-secondary-500/65 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary-600 to-primary-400 px-4 py-1.5 text-button text-gray-700 hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-100"
            type="submit"
            disabled={!isFormValid()}
          >
            Create
          </button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
