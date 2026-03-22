<script lang="ts">
  import LandingFeatureCursorDemo from "$lib/components/landing/LandingFeatureCursorDemo.svelte";
  import LandingFeatureEditorPreview from "$lib/components/landing/LandingFeatureEditorPreview.svelte";
  import LandingFeatureModuleTree from "$lib/components/landing/LandingFeatureModuleTree.svelte";
</script>

<section aria-labelledby="feature-list-heading">
  <h2 id="feature-list-heading" class="sr-only">Feature list</h2>

  <div class="bg-[#f3f4f3] dark:bg-[#2a2a25] h-140 flex justify-center place-items-center w-full overflow-hidden">
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

  <div class="bg-[#ededec] dark:bg-[#252520] h-140 flex justify-center place-items-center w-full overflow-hidden">
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

  <div class="bg-[#f3f4f3] dark:bg-[#2a2a25] h-140 flex justify-center place-items-center w-full overflow-hidden">
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
</section>
