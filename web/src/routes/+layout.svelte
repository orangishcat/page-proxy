<script lang="ts">
  import { asset } from '$app/paths';
  import '../app.css';
  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={asset('/icon.avif')} />
  <meta name="theme-color" content="#20211f" media="(prefers-color-scheme: dark)" />
  <meta name="theme-color" content="#f3f4f3" media="(prefers-color-scheme: light)" />
</svelte:head>

{@render children()}
