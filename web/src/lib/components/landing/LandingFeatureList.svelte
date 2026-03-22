<script lang="ts">
  import LandingFeatureCursorDemo from "$lib/components/landing/LandingFeatureCursorDemo.svelte";
  import LandingFeatureEditorPreview from "$lib/components/landing/LandingFeatureEditorPreview.svelte";
  import LandingFeatureModuleTree from "$lib/components/landing/LandingFeatureModuleTree.svelte";
</script>

<section aria-labelledby="feature-list-heading">
  <h2 id="feature-list-heading" class="sr-only">Feature list</h2>

  <div class="bg-white/50 dark:bg-background/50">
    <div
      class="mx-auto w-full max-w-7xl px-6 py-24 sm:px-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-16 lg:py-28"
    >
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

  <div class="bg-white/30 dark:bg-background/70">
    <div
      class="mx-auto w-full max-w-7xl px-6 py-24 sm:px-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-16 lg:py-28"
    >
      <div>
        <LandingFeatureModuleTree />
      </div>

      <div class="max-w-2xl space-y-5 lg:justify-self-end lg:text-right">
        <h3 class="text-heading text-gray-950 dark:text-white">Powerful scripting API.</h3>
        <p class="text-xl leading-relaxed text-gray-600 dark:text-gray-300">
          Your desired functionality, achieved one helper method at a time.
        </p>
      </div>
    </div>
  </div>

  <div class="bg-white/50 dark:bg-background/50">
    <div
      class="mx-auto w-full max-w-7xl px-6 py-24 overflow-hidden h-142 sm:px-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-16 lg:py-28"
    >
      <div class="max-w-2xl space-y-5">
        <h3 class="text-heading text-gray-950 dark:text-white">Editor included.</h3>
        <p class="text-xl leading-relaxed text-gray-600 dark:text-gray-300">
          Our
          <a href="https://microsoft.github.io/monaco-editor/" target="_blank" rel="noopener noreferrer">Monaco</a
          >-powered editor allows you to edit your scripts without ever leaving the extension.
        </p>
      </div>

      <div class="relative">
        <LandingFeatureEditorPreview />
      </div>
    </div>
  </div>
</section>
