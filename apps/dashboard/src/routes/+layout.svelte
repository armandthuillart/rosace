<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import regular from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
  import medium from "@fontsource/inter/files/inter-latin-500-normal.woff2?url";
  import semibold from "@fontsource/inter/files/inter-latin-600-normal.woff2?url";
  import type { LayoutProps } from "./$types";
  import { handleAuth } from "@repo/auth/sveltekit";

  let { children, data }: LayoutProps = $props();

  handleAuth({
    fetch: async () => !!data.token,
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
  <link
    rel="preload"
    as="font"
    crossorigin="anonymous"
    href={semibold}
    type="font/woff2"
  />
</svelte:head>

{@render children()}
