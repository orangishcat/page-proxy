<script lang="ts">
  import { User } from 'lucide-svelte';
</script>

<div class="interactive-hover box-border flex min-w-52 max-w-full items-center gap-4 rounded-3xl bg-gray-800 px-5 py-4 text-gray-100 shadow-lg hover:bg-gray-900 active:bg-gray-950">
  <div class="grid h-10 w-10 place-items-center rounded-full bg-secondary-500">
    <User class="h-5 w-5 text-gray-950" aria-hidden="true" />
  </div>
  <div class="flex flex-col gap-1">
    <strong class="text-title">Account</strong>
    <span class="text-caption">account_circle</span>
  </div>
</div>
