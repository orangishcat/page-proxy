<script lang="ts">
  import type {Snippet} from 'svelte';

  let {
    title = 'Amazon Redesign',
    author = 'Author 1, Author 2',
    image = '',
    imageUrls = [],
    end
  } = $props<{
    title?: string;
    author?: string;
    image?: string;
    imageUrls?: string[];
    end?: Snippet;
  }>();
</script>

<article class="w-full rounded-3xl border border-gray-200 bg-white p-6 text-gray-950 shadow-lg active:bg-gray-200 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 hover:brightness-90 active:brightness-75">
  {#if image}
    <img class="mb-5 h-40 w-full rounded-3xl object-cover" src={image} alt={title} />
  {:else}
    <div class="mb-5 h-40 rounded-3xl bg-gray-200 dark:bg-gray-850"></div>
  {/if}
  <div class="flex items-center gap-4">
    {#if imageUrls.length}
      <div class="relative h-10 w-12">
        {#each imageUrls as imageUrl, index (imageUrl)}
          <img
            class="absolute h-8 w-8 rounded-full border-2 border-gray-200 object-cover dark:border-gray-900"
            style={`left: ${index / imageUrls.length * 2}rem; top: ${index / imageUrls.length * 2}rem;`}
            src={imageUrl}
            alt=""
          />
        {/each}
      </div>
    {/if}
    <div class="flex min-w-0 flex-1 flex-col gap-1 text-left">
      <strong class="text-title truncate">{title}</strong>
      <span class="text-body truncate">{author}</span>
    </div>
    {#if end}
      <div class="ml-auto flex items-center">
        {@render end()}
      </div>
    {/if}
  </div>
</article>
