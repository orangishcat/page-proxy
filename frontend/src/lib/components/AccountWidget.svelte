<script lang="ts">
  import {LogOut, Settings, User} from 'lucide-svelte';
  import { DropdownMenu } from 'bits-ui';
  import Divider from './Divider.svelte';

  export let name = 'Person 1';
  export let email = 'person@gmail.com';

  const accountButtonClasses = 'p-0';

  const accountMenuClasses =
    'z-10 w-60 rounded-2xl border border-gray-200 bg-gray-100 text-gray-950 shadow-xl dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

  const accountHeaderClasses =
    'flex items-center gap-3 rounded-xl p-4 text-left';

  const accountNameClasses = 'text-body font-semibold text-gray-950 dark:text-gray-100';

  const accountEmailClasses = 'text-caption text-gray-500 dark:text-gray-300';

  const accountItemClasses =
    'text-body flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-gray-950 hover:bg-gray-200 active:bg-gray-300 dark:text-gray-100 dark:hover:bg-gray-900/60 dark:active:bg-gray-900';
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger class="{accountButtonClasses} {$$props.class}" aria-label="Account">
    <div class="grid h-10 w-10 place-items-center rounded-full bg-accent-500">
      <User class="h-5 w-5 text-gray-950" aria-hidden="true"/>
    </div>
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content class={accountMenuClasses} align="end" sideOffset={12} preventScroll={false}>
      <div class={accountHeaderClasses}>
        <div class="grid h-10 w-10 place-items-center rounded-full bg-accent-500">
          <User class="h-5 w-5 text-gray-950" aria-hidden="true"/>
        </div>
        <div class="min-w-0">
          <div class={accountNameClasses}>{name}</div>
          <div class={accountEmailClasses}>{email}</div>
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
        <DropdownMenu.Item class={accountItemClasses}>
          <LogOut class="h-4 w-4 text-gray-500 dark:text-gray-300" aria-hidden="true"/>
          Sign out
        </DropdownMenu.Item>
      </div>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
