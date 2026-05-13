<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import type { LayoutProps } from "./$types";
  import { useConvex } from "$lib/convex";
  import { onMount } from "svelte";

  let { children, data }: LayoutProps = $props();

  useConvex({ shouldFetch: () => !!data.user });

  onMount(() => {
    const style = document.createElement("style");
    style.textContent = "* { transition: none !important; }";
    const mm = matchMedia("(prefers-color-scheme: dark)");

    const suppress = () => {
      if (!style.isConnected) document.head.append(style);
      requestAnimationFrame(() => requestAnimationFrame(() => style.remove()));
    };

    mm.addEventListener("change", suppress);
    return () => mm.removeEventListener("change", suppress);
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
