<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { World } from "@threlte/rapier";
  import Lanyard from "$lib/components/Lanyard.svelte";
  import Scene from "$lib/components/Scene.svelte";

  let theme = $state<"light" | "dark">("dark");

  $effect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    theme = mq.matches ? "light" : "dark";
    const handler = (e: MediaQueryListEvent) =>
      (theme = e.matches ? "light" : "dark");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });
</script>

<div class="flex h-screen w-full items-center justify-center">
  <Canvas>
    <Scene {theme} />
    <World gravity={[0, -40, 0]}>
      <Lanyard {theme} />
    </World>
  </Canvas>
</div>
