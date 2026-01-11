<script lang="ts">
  type ShareToolProps = {
    title: string;
    website: string;
    description: string;
  };

  let {title, website, description}: ShareToolProps = $props();
</script>

<div class="h-full w-full">
  <div class="absolute left-[4.25%] top-[24.62%] w-[91.5%]">
    <span class="pp-share-title">{title}</span>
    {#if website}
      <br />
      <span class="pp-share-text">Applies to </span>
      <span class="pp-share-link">{website}</span>
    {/if}
    {#if description}
      <br />
      <br />
      <span class="pp-share-body">{description}</span>
    {/if}
  </div>
  <button
    class="pp-action-button absolute left-[42%] top-[79.03%] h-[11.25%] w-[16.25%] opacity-60"
    type="button"
    disabled
  >
    Publish
  </button>
</div>
