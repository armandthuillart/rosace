<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { World } from "@threlte/rapier";
  import Lanyard from "$lib/components/Lanyard.svelte";
</script>

<div class="flex h-screen w-full items-center justify-center">
  <Canvas>
    <World gravity={[0, -40, 0]} framerate={60}>
      <Lanyard />
    </World>
  </Canvas>
</div>
