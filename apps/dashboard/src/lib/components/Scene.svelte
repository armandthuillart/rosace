<script lang="ts">
  import { Canvas, T, useThrelte } from "@threlte/core";
  import * as THREE from "three";

  const { scene, renderer } = useThrelte();

  $effect.pre(() => {
    const hdr = new THREE.Scene();
    hdr.background = new THREE.Color("black");
    const geometry = new THREE.PlaneGeometry(1, 1);

    const lightformers = [
      {
        intensity: 2,
        pos: [0, -1, 5],
        rot: [0, 0, Math.PI / 3],
        scale: [100, 0.1, 1],
      },
      {
        intensity: 3,
        pos: [-1, -1, 1],
        rot: [0, 0, Math.PI / 3],
        scale: [100, 0.1, 1],
      },
      {
        intensity: 3,
        pos: [1, 1, 1],
        rot: [0, 0, Math.PI / 3],
        scale: [100, 0.1, 1],
      },
      {
        intensity: 10,
        pos: [-25, 5, 30],
        rot: [0, Math.PI / 2, Math.PI / 3],
        scale: [100, 15, 1],
      },
    ];

    for (const { intensity, pos, rot, scale } of lightformers) {
      const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        color: new THREE.Color(intensity, intensity, intensity),
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...(pos as [number, number, number]));
      mesh.rotation.set(...(rot as [number, number, number]));
      mesh.scale.set(...(scale as [number, number, number]));
      hdr.add(mesh);
    }

    geometry.dispose();

    const pmrem = new THREE.PMREMGenerator(renderer);
    const map = pmrem.fromScene(hdr, 0.01).texture;
    pmrem.dispose();

    scene.background = map;
    scene.environment = map;
    scene.backgroundBlurriness = 0.75;

    return () => {
      map.dispose();
      scene.background = null;
      scene.environment = null;
    };
  });
</script>

<T.AmbientLight intensity={Math.PI} />
