<script lang="ts">
  const modules = [
    { label: "pq", x: 72, y: 228 },
    { label: "pa", x: 160, y: 228 },
    { label: "ps", x: 248, y: 228 },
    { label: "pn", x: 336, y: 228 },
    { label: "pe", x: 424, y: 228 },
    { label: "pst", x: 512, y: 228 },
  ] as const;
</script>

<div class="mx-auto w-full max-w-xl py-6" aria-hidden="true">
  <svg class="w-full overflow-visible" viewBox="0 0 584 280" fill="none" role="presentation">
    <path class="stroke-gray-300 dark:stroke-gray-700" stroke-width="8" stroke-linecap="round" d="M292 78V122"></path>
    <path class="stroke-gray-300 dark:stroke-gray-700" stroke-width="8" stroke-linecap="round" d="M92 154H492"></path>

    {#each modules as module}
      <path class="stroke-gray-300 dark:stroke-gray-700" stroke-width="4" stroke-linecap="round" d={`M${module.x} 154V188`}></path>
    {/each}

    <text x="292" y="56" text-anchor="middle" class="fill-gray-950 text-lg font-semibold dark:fill-white">
      @page-proxy/pp
    </text>

    {#each modules as module}
      <text x={module.x} y={module.y} text-anchor="middle" class="fill-gray-700 text-base font-semibold dark:fill-gray-300">
        {module.label}
      </text>
    {/each}
  </svg>
</div>
