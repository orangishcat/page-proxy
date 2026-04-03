<script lang="ts" module>
  import type { JsonLdEntry } from "$lib/seo";

  export type SeoHeadProps = {
    description: string;
    jsonLd?: JsonLdEntry[];
    noindex?: boolean;
    path: string;
    title?: string;
    type?: string;
    imageAlt?: string;
    imagePath?: string;
  };
</script>

<script lang="ts">
  import {
    createAbsoluteUrl,
    createTitle,
    defaultSocialImageAlt,
    defaultSocialImagePath,
    siteAuthor,
    siteLocale,
    siteName,
  } from "$lib/seo";

  let {
    description,
    jsonLd = [],
    noindex = false,
    path,
    title,
    type = "website",
    imageAlt = defaultSocialImageAlt,
    imagePath = defaultSocialImagePath,
  }: SeoHeadProps = $props();

  const canonicalUrl = $derived(createAbsoluteUrl(path));
  const imageUrl = $derived(imagePath ? createAbsoluteUrl(imagePath) : null);
  const jsonLdMarkup = $derived(
    jsonLd
      .map((entry) => JSON.stringify(entry).replace(/</g, "\\u003C"))
      .map((entry) => `<script type="application/ld+json">${entry}</${"script"}>`)
      .join(""),
  );
  const pageTitle = $derived(createTitle(title));
  const robots = $derived(noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="application-name" content={siteName} />
  <meta name="author" content={siteAuthor} />
  <meta name="description" content={description} />
  <meta name="robots" content={robots} />
  <link rel="canonical" href={canonicalUrl} />

  <meta property="og:description" content={description} />
  <meta property="og:locale" content={siteLocale} />
  <meta property="og:site_name" content={siteName} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:type" content={type} />
  <meta property="og:url" content={canonicalUrl} />

  {#if imageUrl}
    <meta property="og:image" content={imageUrl} />
    <meta property="og:image:alt" content={imageAlt} />
  {/if}

  <meta name="twitter:card" content={imageUrl ? "summary_large_image" : "summary"} />
  <meta name="twitter:description" content={description} />
  {#if imageUrl}
    <meta name="twitter:image" content={imageUrl} />
    <meta name="twitter:image:alt" content={imageAlt} />
  {/if}
  <meta name="twitter:title" content={pageTitle} />

  {@html jsonLdMarkup}
</svelte:head>
