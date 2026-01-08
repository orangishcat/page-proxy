<script lang="ts">
  import type {Snippet} from 'svelte';

  let {
    title = 'Amazon Redesign',
    author = 'Author 1, Author 2',
    image = '',
    imageUrls = [],
    end,
    href
  } = $props<{
    title?: string;
    author?: string;
    image?: string;
    imageUrls?: string[];
    end?: Snippet;
    href?: string;
  }>();
</script>

<article class="relative w-full rounded-3xl border border-gray-200 bg-white p-6 text-gray-950 shadow-lg ring-0
 transition hover:ring-1 hover:ring-gray-500/70 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
>
  {#if href}
    <a
      class="absolute inset-0 z-0 rounded-3xl focus-visible:outline-none"
      href={href}
      aria-label={`Open ${title}`}
    ></a>
  {/if}
  <div class={`relative z-10 ${href ? 'pointer-events-none' : ''}`}>
    {#if image}
      <img class="mb-5 h-40 w-full rounded-3xl object-cover" src={image} alt={title}/>
    {:else}
      <div class="mb-5 h-40 rounded-3xl bg-gray-200 dark:bg-gray-850"></div>
    {/if}
  </div>
  <div class="relative z-10 flex items-center gap-4">
    <div class={`flex min-w-0 flex-1 flex-col gap-1 text-left ${href ? 'pointer-events-none' : ''}`}>
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
      <strong class="text-title truncate">{title}</strong>
      <span class="text-body truncate">{author}</span>
    </div>
    {#if end}
      <div class={`ml-auto flex items-center ${href ? 'pointer-events-auto' : ''}`}>
        {@render end()}
      </div>
    {/if}
  </div>
</article>
