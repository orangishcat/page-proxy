<script lang="ts">
  import { Separator } from 'bits-ui';

  const props = $props<{ class?: string }>();
  const restProps = $derived.by(() => {
    const { class: _class, ...rest } = props;
    return rest;
  });
  const dividerClasses = $derived.by(() =>
    `h-px w-full bg-gray-300/70 dark:bg-gray-500/80 ${props.class ?? ''}`.trim()
  );
</script>

<Separator.Root {...restProps} class={dividerClasses} />
