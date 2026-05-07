<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import type { LayoutProps } from "./$types";
  import { useConvex } from "$lib/convex";

  let { children, data }: LayoutProps = $props();

  useConvex({
    shouldFetch: () => !!data.user,
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
