<svelte:head>
  <title>Dashboard | Page Proxy</title>
</svelte:head>

<script lang="ts">
  import Navbar from '$lib/components/Navbar.svelte';
  import GridItem from '$lib/components/GridItem.svelte';
  import NewFileModal from '$lib/components/NewFileModal.svelte';
  import Button from '$lib/components/Button.svelte';
  import {
    createFile,
    deleteFile,
    getLoginState,
    isResultError,
    listFiles,
    type FileEntry
  } from '$lib/data/files';
  import {Dialog, DropdownMenu} from 'bits-ui';
  import {MoreHorizontal, Trash2} from 'lucide-svelte';
  import {onMount} from 'svelte';

  let files = $state<FileEntry[]>([]);
  let status = $state<'idle' | 'loading' | 'error'>('loading');
  let errorMessage = $state<string | null>(null);
  let isNewModalOpen = $state(false);
  let isDeleteDialogOpen = $state(false);
  let deleteTarget = $state<FileEntry | null>(null);
  let isDeleting = $state(false);

  const menuTriggerClasses =
    'grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-gray-100 text-gray-700 shadow-md transition hover:bg-gray-200 active:bg-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:active:bg-gray-600';
  const menuContentClasses =
    'z-10 min-w-40 rounded-2xl border border-gray-200 bg-gray-100 p-2 text-gray-700 shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
  const menuItemClasses =
    'text-body flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-gray-200 active:bg-gray-300 dark:hover:bg-gray-900/60 dark:active:bg-gray-900';

  const refreshFiles = async () => {
    status = 'loading';
    errorMessage = null;

    const result = await listFiles();
    if (isResultError(result)) {
      status = 'error';
      errorMessage = result.error;
      return;
    }

    files = result.value;
    status = 'idle';
  };

  const handleNewFile = () => {
    isNewModalOpen = true;
  };

  const handleCreateFile = async (
    event: CustomEvent<{title: string; website: string; description: string}>
  ) => {
    const {title, website, description} = event.detail;
    const contentLines = [
      website ? `Website: ${website}` : null,
      description ? `Description: ${description}` : null
    ].filter((line): line is string => Boolean(line));
    const content = contentLines.join('\n');
    const result = await createFile(title || 'Untitled.txt', content);
    if (isResultError(result)) {
      errorMessage = result.error;
      status = 'error';
      return;
    }

    files = [result.value, ...files];
    isNewModalOpen = false;
  };

  const requestDelete = (file: FileEntry) => {
    deleteTarget = file;
    isDeleteDialogOpen = true;
  };

  const handleDeleteFile = async () => {
    if (!deleteTarget) {
      return;
    }
    isDeleting = true;
    const result = await deleteFile(deleteTarget.id);
    if (isResultError(result)) {
      errorMessage = result.error;
      status = 'error';
      isDeleting = false;
      return;
    }

    files = files.filter((file) => file.id !== deleteTarget?.id);
    isDeleteDialogOpen = false;
    deleteTarget = null;
    isDeleting = false;
  };

  onMount(async () => {
    const loginState = await getLoginState();
    if (isResultError(loginState)) {
      await refreshFiles();
      errorMessage = loginState.error;
      status = 'error';
      return;
    }

    await refreshFiles();
  });
</script>

<main class="min-h-screen text-gray-100">
  <div class="mx-auto flex w-full justify-center place-items-center flex-col gap-14 px-6 pb-20 pt-8 relative">
    <Navbar variant="dashboard" on:newfile={handleNewFile} />
    <NewFileModal bind:open={isNewModalOpen} on:submit={handleCreateFile} />
    <Dialog.Root bind:open={isDeleteDialogOpen}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm dark:bg-gray-950/70" />
        <Dialog.Content
          class="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-300 bg-gray-100 p-6 text-gray-700 shadow-2xl will-change-[transform,opacity] data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <div class="grid gap-3">
            <Dialog.Title class="text-title text-gray-950 dark:text-gray-100">
              Delete file?
            </Dialog.Title>
            <Dialog.Description class="text-body text-gray-600 dark:text-gray-300">
              This will permanently delete
              <span class="font-semibold text-gray-950 dark:text-gray-100">
                {deleteTarget?.name ?? 'this file'}
              </span>
              .
            </Dialog.Description>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <Dialog.Close
              class="rounded-xl border border-secondary-500 bg-secondary-500 px-4 py-2 text-button text-gray-950 hover:opacity-80 active:opacity-60 dark:text-gray-100"
            >
              Cancel
            </Dialog.Close>
            <Button
              variant="primary"
              class="px-4 py-2"
              type="button"
              disabled={isDeleting}
              onclick={handleDeleteFile}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    <section class="grid w-full max-w-7xl gap-6 md:grid-cols-3 lg:grid-cols-4 min-h-[18rem] relative">
      {#if status === 'loading'}
        <div class="col-span-full flex min-h-[18rem] items-center justify-center text-lead text-gray-300">
          Loading files...
        </div>
      {:else if files.length === 0}
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="text-center">
            <div class="text-lead font-semibold text-gray-100">No files yet</div>
            <p class="text-body text-gray-300 mt-2">
              Create a new text file to get started.
            </p>
          </div>
        </div>
      {:else}
        {#each files as file (file.id)}
          <GridItem
            title={file.name}
            author={file.source === 'appwrite' ? 'Appwrite' : 'Local file'}
          >
            {#snippet end()}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger class={menuTriggerClasses} aria-label="File actions">
                  <MoreHorizontal class="h-5 w-5" aria-hidden="true" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    class={menuContentClasses}
                    align="end"
                    sideOffset={8}
                    preventScroll={false}
                  >
                    <DropdownMenu.Item
                      class={menuItemClasses}
                      onclick={() => requestDelete(file)}
                    >
                      <Trash2 class="h-4 w-4 text-red-500 dark:text-red-400" aria-hidden="true" />
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            {/snippet}
          </GridItem>
        {/each}
      {/if}
    </section>
    {#if status === 'error' && errorMessage}
      <p class="text-body text-red-200">{errorMessage}</p>
    {/if}
  </div>
</main>
