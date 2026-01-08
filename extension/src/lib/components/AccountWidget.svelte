<script lang="ts">
  import {onMount} from 'svelte';
  import {LogOut, Settings, User} from 'lucide-svelte';
  import { DropdownMenu } from 'bits-ui';
  import Divider from './Divider.svelte';
  import {getAccount, signOut, type AccountProfile} from '../data/files';

  let account = $state<AccountProfile | null>(null);
  let isLoading = $state(true);

  const props = $props<{ class?: string }>();
  const accountButtonClasses = 'p-0';

  const accountMenuClasses =
    'z-10 w-60 rounded-2xl border border-gray-200 bg-gray-100 text-gray-950 shadow-xl dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

  const accountHeaderClasses =
    'flex items-center gap-3 rounded-xl p-4 text-left';

  const accountNameClasses = 'text-body font-semibold text-gray-950 dark:text-gray-100';

  const accountEmailClasses = 'text-caption text-gray-500 dark:text-gray-300';

  const accountItemClasses =
    'text-body flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-gray-950 hover:bg-gray-200 active:bg-gray-300 dark:text-gray-100 dark:hover:bg-gray-900/60 dark:active:bg-gray-900';

  const accountEmptyClasses = 'px-4 py-3 text-body text-gray-600 dark:text-gray-300';

  const triggerClasses = $derived(
    `${accountButtonClasses} ${props.class ?? ''}`.trim()
  );

  const accountName = $derived(account?.name ?? '');
  const accountEmail = $derived(account?.email ?? '');

  const loadAccount = () => {
    isLoading = true;
    return getAccount().then((result) => {
      if (result.ok) {
        account = result.value;
      } else {
        account = null;
      }
      isLoading = false;
    });
  };

  const handleSignOut = () =>
    signOut().then((result) => {
      if (result.ok) {
        account = null;
      }
    });

  const onSignOutClick = () => {
    void handleSignOut();
  };

  onMount(() => {
    void loadAccount();
  });
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger class={triggerClasses} aria-label="Account">
    <div class="grid h-10 w-10 place-items-center rounded-full bg-accent-500">
      <User class="h-5 w-5 text-gray-950" aria-hidden="true"/>
    </div>
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content class={accountMenuClasses} align="end" sideOffset={12} preventScroll={false}>
      {#if isLoading}
        <div class={accountEmptyClasses}>Loading account...</div>
      {:else if account}
        <div class={accountHeaderClasses}>
          <div class="grid h-10 w-10 place-items-center rounded-full bg-accent-500">
            <User class="h-5 w-5 text-gray-950" aria-hidden="true"/>
          </div>
          <div class="min-w-0">
            <div class={accountNameClasses}>{accountName}</div>
            <div class={accountEmailClasses}>{accountEmail}</div>
          </div>
        </div>
        <Divider/>
        <div class="p-2">
          <DropdownMenu.Item class={accountItemClasses}>
            <User class="h-4 w-4 text-gray-500 dark:text-gray-300" aria-hidden="true"/>
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item class={accountItemClasses}>
            <Settings class="h-4 w-4 text-gray-500 dark:text-gray-300" aria-hidden="true"/>
            Settings
          </DropdownMenu.Item>
          <DropdownMenu.Item class={accountItemClasses} onclick={onSignOutClick}>
            <LogOut class="h-4 w-4 text-gray-500 dark:text-gray-300" aria-hidden="true"/>
            Sign out
          </DropdownMenu.Item>
        </div>
      {:else}
        <div class={accountEmptyClasses}>Not signed in</div>
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
