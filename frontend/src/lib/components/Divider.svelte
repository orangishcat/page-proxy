<script lang="ts">
  import { Separator } from 'bits-ui';

  const { class: className = '', ...rest } = $props<{ class?: string }>();

  const dividerClasses =
    `h-[0.0625rem] w-full bg-gray-200 dark:bg-gray-600 ${className}`.trim();
</script>

<Separator.Root {...rest} class={dividerClasses} />
