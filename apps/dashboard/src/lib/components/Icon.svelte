<script lang="ts">
  import type { SVGAttributes } from "svelte/elements";

  const spriteNames = ["apple", "google", "rosace"] as const;

  type IconName = (typeof spriteNames)[number];

  interface Props extends SVGAttributes<SVGSVGElement> {
    name: IconName;
  }

  let { name, ...props }: Props = $props();
</script>

<svg
  aria-hidden="true"
  fill="currentColor"
  viewBox="0 0 24 24"
  xmlns="http://www.w3.org/2000/svg"
  {...props}
>
  <use href={`/sprites.svg#${name}`}></use>
</svg>
