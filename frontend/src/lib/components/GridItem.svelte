<script lang="ts">
  export let title = 'Amazon Redesign';
  export let author = 'Author 1, Author 2';
  export let image = '';
  export let avatars: string[] = [];
</script>

<article class="w-96 rounded-3xl bg-white p-6 text-gray-950 shadow-lg hover:bg-gray-50 active:bg-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:active:bg-gray-950">
  {#if image}
    <img class="mb-5 h-56 w-full rounded-3xl object-cover" src={image} alt={title} />
  {:else}
    <div class="mb-5 h-56 rounded-3xl bg-gray-200 dark:bg-gray-800"></div>
  {/if}
  <div class="flex items-center gap-4">
    {#if avatars.length}
      <div class="relative h-10 w-12">
        {#each avatars as avatar, index (avatar)}
          <img
            class="absolute h-8 w-8 rounded-full border-2 border-gray-200 object-cover dark:border-gray-900"
            style={`left: ${index / avatars.length * 2}rem; top: ${index / avatars.length * 2}rem;`}
            src={avatar}
            alt=""
          />
        {/each}
      </div>
    {/if}
    <div class="flex min-w-0 flex-1 flex-col gap-1 text-left">
      <strong class="text-title truncate">{title}</strong>
      <span class="text-body truncate">{author}</span>
    </div>
  </div>
</article>
