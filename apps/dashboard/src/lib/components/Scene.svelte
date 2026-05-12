<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import * as THREE from "three";
  const { scene, renderer } = useThrelte();
  import { isDarkMode } from "$lib/stores/theme";

  $effect.pre(() => {
    const dark = $isDarkMode;

    const hdr = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(1, 1);

    const i = dark ? 1 : 8;

    const lightformers = [
      {
        intensity: i * 2,
        pos: [0, -1, 5],
        rot: [0, 0, Math.PI / 3],
        scale: [100, 0.1, 1],
      },
      {
        intensity: i * 3,
        pos: [-1, -1, 1],
        rot: [0, 0, Math.PI / 3],
        scale: [100, 0.1, 1],
      },
      {
        intensity: i * 3,
        pos: [1, 1, 1],
        rot: [0, 0, Math.PI / 3],
        scale: [100, 0.1, 1],
      },
      {
        intensity: i * 10,
        pos: [-10, 0, 27.5],
        rot: [0, Math.PI / 2, Math.PI / 3],
        scale: [100, 10, 1],
      },
    ];

    for (const { intensity, pos, rot, scale } of lightformers) {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(intensity, intensity, intensity),
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...(pos as [number, number, number]));
      mesh.rotation.set(...(rot as [number, number, number]));
      mesh.scale.set(...(scale as [number, number, number]));
      hdr.add(mesh);
    }

    geometry.dispose();

    const pmrem = new THREE.PMREMGenerator(renderer);
    const map = pmrem.fromScene(hdr, 0, 0.1, 1000).texture;
    pmrem.dispose();

    scene.environment = map;
    scene.background = dark ? map : new THREE.Color(0xd9d9d9);
    scene.backgroundBlurriness = 0.75;

    return () => {
      map.dispose();
      scene.background = null;
      scene.environment = null;
    };
  });
</script>

<T.AmbientLight intensity={Math.PI} />
