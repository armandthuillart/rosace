<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { World } from "@threlte/rapier";
  import Lanyard from "$lib/components/Lanyard.svelte";
  import Scene from "$lib/components/Scene.svelte";
</script>

<div class="flex h-screen w-full items-center justify-center">
  <Canvas dpr={[1, 2]}>
    <Scene />
    <World gravity={[0, -40, 0]} framerate={60}>
      <Lanyard />
    </World>
  </Canvas>
</div>
