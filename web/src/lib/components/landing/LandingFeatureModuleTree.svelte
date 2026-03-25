<script lang="ts">
  import { asset } from "$app/paths";

  const flowChartSrc = asset("/assets/flow_chart.avif");
</script>

<div class="mx-auto w-full max-w-lg rounded-sm" aria-hidden="true">
  <img
    src={flowChartSrc}
    alt="API flow chart"
    class="block w-full select-none object-cover object-top"
    draggable="false"
  />
</div>
