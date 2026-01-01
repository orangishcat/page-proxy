<script lang="ts">
  import { Separator } from 'bits-ui';

  const props = $props<{ class?: string }>();
  const restProps = $derived(() => {
    const { class: _class, ...rest } = props;
    return rest;
  });
  const dividerClasses = $derived(() =>
    `h-[0.0625rem] w-full bg-gray-200 dark:bg-gray-600 ${props.class ?? ''}`.trim()
  );
</script>

<Separator.Root {...restProps} class={dividerClasses} />
