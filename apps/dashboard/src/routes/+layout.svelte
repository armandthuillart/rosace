<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import regular from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
  import medium from "@fontsource/inter/files/inter-latin-500-normal.woff2?url";
  import { convex } from "@repo/convex/svelte";
  import { client } from "$lib/auth";

  let { children, data } = $props();

  convex({
    client,
    server: () => data.auth,
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link
    rel="preload"
    as="font"
    crossorigin="anonymous"
    href={regular}
    type="font/woff2"
  />
  <link
    rel="preload"
    as="font"
    crossorigin="anonymous"
    href={medium}
    type="font/woff2"
  />
</svelte:head>

{@render children()}
