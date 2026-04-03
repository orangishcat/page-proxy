<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import SeoHead from "$lib/components/SeoHead.svelte";
  import Navbar from "$lib/components/Navbar.svelte";
  import Button from "$lib/components/Button.svelte";
  import LandingDemoSelect from "$lib/components/landing/LandingDemoSelect.svelte";
  import LandingFeatureCursorDemo from "$lib/components/landing/LandingFeatureCursorDemo.svelte";
  import LandingFeatureModuleTree from "$lib/components/landing/LandingFeatureModuleTree.svelte";
  import LandingFeatureEditorPreview from "$lib/components/landing/LandingFeatureEditorPreview.svelte";
  import LandingExploreSection from "$lib/components/landing/LandingExploreSection.svelte";
  import { createSoftwareApplicationJsonLd, createWebPageJsonLd, createWebsiteJsonLd, siteDescription } from "$lib/seo";
  import { releaseVersion } from "$lib/utils/release-version";

  const githubUrl = "https://github.com/orangishcat/page-proxy";
  const landingJsonLd = [
    createWebsiteJsonLd(),
    createSoftwareApplicationJsonLd(releaseVersion),
    createWebPageJsonLd({
      description: siteDescription,
      path: "/",
    }),
  ];
</script>

<SeoHead description={siteDescription} path="/" jsonLd={landingJsonLd} />

<main class="min-h-screen bg-page-light text-[#20211f] dark:bg-page dark:text-white">
  <Navbar variant="landing" />

  <div class="flex w-full flex-col mt-12">
    <section>
      <div class="mx-auto w-full max-w-7xl py-56">
        <div class="mx-auto flex flex-col items-center gap-4 text-center space-y-4">
          <h1 class="text-display text-[#20211f] dark:text-white">
            Customization at your <span class="text-accent-500">fingertips.</span>
          </h1>
          <p class="text-2xl text-[#5e635e] dark:text-[#a8a8a8]">
            A browser extension and userscript manager for Chrome and Firefox, with GUI tools and a built in code
            editor.
          </p>

          <div class="mt-2 flex items-center gap-5">
            <a href={resolve("/install")}>
              <Button variant="primary" class="w-32">Install</Button>
            </a>
            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                class="rounded-lg border border-gray-700 px-5 py-2.5 text-black dark:text-white"
              >
                Star on GitHub
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>

    <section
      class="[&>*:nth-child(odd)]:bg-[#f3f4f3] [&>*:nth-child(odd)]:dark:bg-[#2a2a25] [&>*:nth-child(even)]:bg-[#ededec] [&>*:nth-child(even)]:dark:bg-[#252520] *:px-12"
    >
      <section class="py-16 flex flex-col items-center" id="tools">
        <div class="mx-auto w-full text-center max-w-7xl">
          <h2 class="text-4xl font-bold text-gray-900 dark:text-white">Simple, robust workflow.</h2>
          <p class="text-subtitle text-gray-600 mt-4 dark:text-gray-300">
            Perform an action, record it, then convert it to code to keep your changes.
          </p>

          <div class="mt-9 w-full">
            <LandingDemoSelect />
          </div>
        </div>
      </section>

      <div class="h-140 flex justify-center place-items-center w-full overflow-hidden">
        <div class="mx-auto w-full max-w-7xl h-full grid grid-cols-2 items-center gap-20">
          <div class="max-w-2xl space-y-5">
            <h3 class="text-heading text-gray-950 dark:text-white">More designing, less tinkering.</h3>
            <p class="text-xl leading-relaxed text-gray-600 dark:text-gray-300">
              Easy-to-use GUI-based tools will handle it all. Iterate quickly with robust popups, instant previews, and
              more.
            </p>
          </div>

          <LandingFeatureCursorDemo />
        </div>
      </div>

      <div class="h-140 flex justify-center place-items-center w-full overflow-hidden">
        <div class="mx-auto w-full max-w-7xl h-full grid grid-cols-2 items-center gap-20">
          <LandingFeatureModuleTree />

          <div class="max-w-2xl space-y-5 justify-self-end text-right">
            <h3 class="text-heading text-gray-950 dark:text-white">Powerful scripting API.</h3>
            <p class="text-xl leading-relaxed text-gray-600 dark:text-gray-300">
              Implement your desired functionality easily with our API's many helper methods.
            </p>
          </div>
        </div>
      </div>

      <div class="h-140 flex justify-center place-items-center w-full overflow-hidden">
        <div class="mx-auto w-full max-w-7xl h-full grid grid-cols-2 items-center gap-20">
          <div class="max-w-2xl space-y-5">
            <h3 class="text-heading text-gray-950 dark:text-white">Editor included.</h3>
            <p class="text-xl leading-relaxed text-gray-600 dark:text-gray-300">
              Our
              <a href="https://microsoft.github.io/monaco-editor/" target="_blank" rel="noopener noreferrer">Monaco</a
              >-powered editor allows you to edit your scripts without ever leaving the extension.
            </p>
          </div>

          <div class="relative h-full mt-40 flex justify-end">
            <LandingFeatureEditorPreview />
          </div>
        </div>
      </div>

      <div class="flex justify-center w-full overflow-hidden px-6">
        <LandingExploreSection />
      </div>

      <div class="h-140 flex justify-center place-items-center w-full overflow-hidden">
        <section class="mx-auto flex w-full max-w-7xl flex-col items-center space-y-8 py-32">
          <img src={asset("/logo_filled.avif")} alt="Page Proxy logo" class="h-50 w-50" draggable="false" />
          <h3 class="text-heading text-center text-[#20211f] dark:text-white">Take control of your web.</h3>

          <div class="flex items-center gap-5">
            <a href={resolve("/install")}>
              <Button variant="primary">Install</Button>
            </a>
            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                class="rounded-lg border border-gray-700 px-5 py-2.5 text-black dark:text-white"
              >
                Star on GitHub
              </Button>
            </a>
          </div>
        </section>
      </div>
    </section>
  </div>
</main>
