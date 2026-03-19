<script lang="ts">
  import { asset } from '$app/paths';
  import '../app.css';
  import {onMount} from 'svelte';
  let {children} = $props();

  const suffix = ' | Page Proxy';

  const applyTitleSuffix = () => {
    if (typeof document === 'undefined') {
      return;
    }

    const currentTitle = document.title.trim();
    if (!currentTitle) {
      document.title = 'Page Proxy';
      return;
    }

    if (currentTitle === 'Page Proxy' || currentTitle.endsWith(suffix)) {
      return;
    }

    document.title = `${currentTitle}${suffix}`;
  };

  onMount(() => {
    applyTitleSuffix();

    const head = document.head;
    if (!head) {
      return;
    }

    const observer = new MutationObserver(() => {
      applyTitleSuffix();
    });

    observer.observe(head, {childList: true, subtree: true});

    return () => observer.disconnect();
  });
</script>

<svelte:head>
  <link rel="icon" href={asset('/icon.avif')} />
</svelte:head>

{@render children()}
