<script lang="ts">
  import { asset } from "$app/paths";
  import { Disc, MousePointerIcon, Navigation, Paintbrush, Save } from "lucide-svelte";
  import { onMount } from "svelte";
  import {
    LANDING_HERO_ASSETS,
    LANDING_HERO_SCENE_MAP,
    LANDING_HERO_RECTS,
    type LandingHeroSceneId,
    type LandingHeroSectionId,
  } from "$lib/components/landing/landing-demo-sequence";
  import { buildTabProgress, imageLayerClasses, rectStyle, tabBackgroundStyle } from "$lib/components/landing/landing-demo-progress";
  import { createLandingDemoPlaybackController } from "$lib/components/landing/landing-demo-playback";

  const heroTabs = [
    { id: "select", label: "Select" },
    { id: "apply-style", label: "Apply style" },
    { id: "record", label: "Record" },
    { id: "save-code", label: "Save code" },
  ] as const satisfies readonly { id: LandingHeroSectionId; label: string }[];

  const pageImageSrc = {
    before: asset(LANDING_HERO_ASSETS.page.before),
    after: asset(LANDING_HERO_ASSETS.page.after),
  };

  const toolImageSrc = {
    "select-empty": asset(LANDING_HERO_ASSETS.tool["select-empty"]),
    "select-selected": asset(LANDING_HERO_ASSETS.tool["select-selected"]),
    record: asset(LANDING_HERO_ASSETS.tool.record),
    "record-selected": asset(LANDING_HERO_ASSETS.tool["record-selected"]),
  };

  const editorImageSrc = {
    empty: asset(LANDING_HERO_ASSETS.editor.empty),
    saved: asset(LANDING_HERO_ASSETS.editor.saved),
  };

  const overlayImageSrc = {
    menu: asset(LANDING_HERO_ASSETS.overlays.menu),
    popup: asset(LANDING_HERO_ASSETS.overlays.popup),
  };

  let sceneId = $state<LandingHeroSceneId>("initial");
  let sceneOverrideId = $state<LandingHeroSceneId | null>(null);
  let isReducedMotion = $state(false);

  const visibleSceneId = $derived(sceneOverrideId ?? sceneId);
  const scene = $derived(LANDING_HERO_SCENE_MAP[visibleSceneId]);

  let rootEl: HTMLDivElement | null = null;
  let pagePanelEl: HTMLElement | null = null;
  let toolPanelEl: HTMLElement | null = null;
  let editorPanelEl: HTMLElement | null = null;
  let cursorEl: HTMLDivElement | null = null;
  let pulseEl: HTMLDivElement | null = null;
  let activeSectionId = $state<LandingHeroSectionId>("select");
  let activeSectionProgress = $state(0);
  let pendingSectionId = $state<LandingHeroSectionId | null>(null);
  let isPlaybackReady = $state(false);
  const playback = createLandingDemoPlaybackController(
    {
      getRootEl: () => rootEl,
      getPagePanelEl: () => pagePanelEl,
      getToolPanelEl: () => toolPanelEl,
      getEditorPanelEl: () => editorPanelEl,
      getCursorEl: () => cursorEl,
      getPulseEl: () => pulseEl,
    },
    {
      getSceneId: () => sceneId,
      getPendingSectionId: () => pendingSectionId,
      setSceneId: (nextSceneId) => {
        sceneId = nextSceneId;
      },
      setSceneOverrideId: (nextSceneId) => {
        sceneOverrideId = nextSceneId;
      },
      setIsReducedMotion: (value) => {
        isReducedMotion = value;
      },
      setIsPlaybackReady: (value) => {
        isPlaybackReady = value;
      },
      setActiveSectionId: (sectionId) => {
        activeSectionId = sectionId;
      },
      setActiveSectionProgress: (value) => {
        activeSectionProgress = value;
      },
      setPendingSectionId: (sectionId) => {
        pendingSectionId = sectionId;
      },
    },
  );

  const tabProgress = $derived.by(() => buildTabProgress(heroTabs, activeSectionId, activeSectionProgress));

  const jumpToSection = (sectionId: LandingHeroSectionId) => {
    playback.jumpToSection(sectionId);
  };

  onMount(() => playback.start());
</script>

<div class="mx-auto flex w-full justify-center overflow-x-auto">
  <div class="flex w-full min-w-200 max-w-[72vw] px-4 flex-col items-center">
    <div
      bind:this={rootEl}
      class="relative grid w-full grid-cols-[minmax(0,1.331fr)_minmax(0,0.415fr)] gap-0 border rounded-lg border-gray-200 dark:border-gray-800"
      data-demo-ready={isPlaybackReady ? "true" : "false"}
      data-demo-step={visibleSceneId}
      data-testid="landing-demo"
    >
      <section
        bind:this={pagePanelEl}
        class="relative rounded-l-lg overflow-hidden"
        style="aspect-ratio:2560 / 1926;"
        aria-label="Landing demo page"
      >
        <img
          class={imageLayerClasses(scene.pageFrame === "before")}
          src={pageImageSrc.before}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        <img
          class={imageLayerClasses(scene.pageFrame === "after")}
          src={pageImageSrc.after}
          alt=""
          aria-hidden="true"
          draggable="false"
        />

        <div
          class={`absolute rounded-sm border-[0.16rem] transition-opacity duration-300 ease-out ${
            scene.sidebarState === "hidden"
              ? "opacity-0"
              : scene.sidebarState === "hover"
                ? "border-accent-500"
                : "border-secondary-400"
          }`}
          style={rectStyle(LANDING_HERO_RECTS.sidebar)}
        ></div>

        <div
          class={`absolute inset-0 bg-black/55 transition-opacity duration-400 ${
            scene.scrimVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        ></div>

        <img
          class={`absolute object-cover shadow-[0_1.6em_3.2em_-2em_rgba(0,0,0,0.6)] transition-opacity duration-500 ease-out ${
            scene.popupVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={`${rectStyle(LANDING_HERO_RECTS.popup)} aspect-ratio:2144 / 1318;`}
          src={overlayImageSrc.popup}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      </section>

      <div class="grid grid-rows-[600fr_1322fr] gap-0 rounded-r-lg overflow-hidden">
        <section
          bind:this={toolPanelEl}
          class="relative overflow-visible bg-[#24241f]"
          style="aspect-ratio:798 / 600;"
          aria-label="Landing demo tool panel"
        >
          <img
            class={imageLayerClasses(scene.toolFrame === "select-empty")}
            src={toolImageSrc["select-empty"]}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <img
            class={imageLayerClasses(scene.toolFrame === "select-selected")}
            src={toolImageSrc["select-selected"]}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <img
            class={imageLayerClasses(scene.toolFrame === "record")}
            src={toolImageSrc.record}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <img
            class={imageLayerClasses(scene.toolFrame === "record-selected")}
            src={toolImageSrc["record-selected"]}
            alt=""
            aria-hidden="true"
            draggable="false"
          />

          <img
            class={`absolute object-cover transition-all duration-300 ease-out ${
              scene.menuVisible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-[0.3em]"
            }`}
            style={`${rectStyle(LANDING_HERO_RECTS.menu)} aspect-ratio:448 / 356;`}
            src={overlayImageSrc.menu}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        </section>

        <section
          bind:this={editorPanelEl}
          class="relative overflow-hidden bg-[#24241f]"
          style="aspect-ratio:798 / 1322;"
          aria-label="Landing demo code editor"
        >
          <img
            class={imageLayerClasses(scene.editorFrame === "empty")}
            src={editorImageSrc.empty}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <img
            class={imageLayerClasses(scene.editorFrame === "saved")}
            src={editorImageSrc.saved}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        </section>
      </div>

      <div
        bind:this={pulseEl}
        class="pointer-events-none absolute left-0 top-0 z-20 h-[1.1em] w-[1.1em] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#a8ef52]/70 bg-[#9ee34a]/30 opacity-0"
      ></div>

      <div
        bind:this={cursorEl}
        class={`pointer-events-none absolute left-0 top-0 z-30 -translate-x-[0.7em] -translate-y-[0.38em] ${isReducedMotion ? "hidden" : "block"}`}
      >
        <Navigation class="h-[1.6em] w-[1.6em] -scale-x-100 fill-black text-white" strokeWidth={2.15} />
      </div>
    </div>

    <div class="pointer-events-auto relative z-50 mt-8 flex items-center justify-center gap-4 text-md tracking-wide">
      {#each tabProgress as tab (tab.id)}
        <button
          type="button"
          aria-label={tab.label}
          class={`relative flex h-8 cursor-pointer items-center justify-center overflow-hidden border rounded-lg
          px-6 py-5 text-center transition-all duration-700 ease-out ${
            tab.isActive
              ? "border-[#4b5a2a] dark:text-gray-100"
              : "border-[#3d3b2f] text-gray-700 dark:text-gray-400 hover:border-[#596542]"
          }`}
          data-testid={`hero-tab-${tab.id}`}
          onclick={() => {
            jumpToSection(tab.id);
          }}
          onpointerdown={() => {
            jumpToSection(tab.id);
          }}
          onfocus={() => {
            jumpToSection(tab.id);
          }}
          style={tabBackgroundStyle(tab.isActive, tab.progress)}
        >
          <div
            class="relative z-10 flex place-items-center justify-center gap-2.5 text-center font-medium leading-none"
          >
            {#if tab.id === "select"}
              <MousePointerIcon class="h-6 w-6" strokeWidth={2.15} />
            {:else if tab.id === "apply-style"}
              <Paintbrush class="h-6 w-6" />
            {:else if tab.id === "record"}
              <Disc class="h-6 w-6" />
            {:else}
              <Save class="h-6 w-6" />
            {/if}
            <span>{tab.label}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>
</div>
