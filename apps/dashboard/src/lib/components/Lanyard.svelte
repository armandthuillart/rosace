<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf, useTexture, interactivity } from "@threlte/extras";
  import { MeshLineGeometry, MeshLineMaterial } from "meshline";
  import {
    RigidBody,
    Collider,
    useRopeJoint,
    useSphericalJoint,
    usePhysicsTask,
  } from "@threlte/rapier";
  import * as THREE from "three";
  import type { RigidBody as RapierRigidBody } from "@dimforge/rapier3d-compat";

  interactivity();

  const { camera, size } = useThrelte();

  let fixed: RapierRigidBody | undefined = $state(),
    j1: RapierRigidBody | undefined = $state(),
    j2: RapierRigidBody | undefined = $state(),
    j3: RapierRigidBody | undefined = $state(),
    card: RapierRigidBody | undefined = $state();

  let vec = new THREE.Vector3(),
    ang = new THREE.Vector3(),
    dir = new THREE.Vector3(),
    ndc = new THREE.Vector2(),
    drag = new THREE.Vector3();

  const gltf = useGltf("/tag.glb");
  const texture = useTexture("/band.jpg");

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);

  let dragged = $state(false);
  let hovered = $state(false);

  let joint = useSphericalJoint([0, 0, 0], [0, 1.475, 0]),
    r1 = useRopeJoint([0, 0, 0], [0, 0, 0], 1),
    r2 = useRopeJoint([0, 0, 0], [0, 0, 0], 1),
    r3 = useRopeJoint([0, 0, 0], [0, 0, 0], 1);

  let j1Lerp = new THREE.Vector3();
  let j2Lerp = new THREE.Vector3();

  $effect(() => {
    if (fixed && j1) {
      r1.rigidBodyA.set(fixed);
      r1.rigidBodyB.set(j1);
    }
  });
  $effect(() => {
    if (j1 && j2) {
      r2.rigidBodyA.set(j1);
      r2.rigidBodyB.set(j2);
    }
  });
  $effect(() => {
    if (j2 && j3) {
      r3.rigidBodyA.set(j2);
      r3.rigidBodyB.set(j3);
    }
  });
  $effect(() => {
    if (j3 && card) {
      joint.rigidBodyA.set(j3);
      joint.rigidBodyB.set(card);
    }
  });

  $effect(() => {
    document.body.style.cursor = dragged
      ? "grabbing"
      : hovered
        ? "grab"
        : "auto";
  });

  const geometry = new MeshLineGeometry();

  usePhysicsTask((delta) => {
    if (!card || !j1 || !j3 || !fixed) return;

    if (dragged) {
      vec.set(ndc.x, ndc.y, 0.5).unproject(camera.current);
      dir.copy(vec).sub(camera.current.position).normalize();
      vec.add(dir.multiplyScalar(camera.current.position.length()));
      card?.setNextKinematicTranslation({
        x: vec.x - drag.x,
        y: vec.y - drag.y,
        z: vec.z - drag.z,
      });
    }
    // Fix most of the jitter when over pulling the card.
    const lerps = [j1Lerp, j2Lerp];
    for (let i = 0; i < [j1, j2].length; i++) {
      const j = [j1, j2][i];
      const lerp = lerps[i];
      if (!j) continue;
      const t = j.translation();
      const distance = lerp.distanceTo(t);
      const clamped = Math.max(0.1, Math.min(1, distance));
      lerp.lerp(vec.set(t.x, t.y, t.z), delta * (10 + clamped * 40));
    }
    // Calculate catmul curve.
    curve.points[0].copy(j3.translation());
    curve.points[1].copy(j2Lerp);
    curve.points[2].copy(j1Lerp);
    curve.points[3].copy(fixed.translation());
    geometry.setPoints(curve.getPoints(32));
    // Tilt it back towards the screen.
    ang.copy(card.angvel());
    const r = card.rotation();
    const euler = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion(r.x, r.y, r.z, r.w),
    );
    card.setAngvel(
      { x: ang.x, y: ang.y - next * euler.y * 0.25, z: ang.z },
      true,
    );
  });

  curve.curveType = "chordal";

  const material = new MeshLineMaterial({
    color: new THREE.Color("white"),
    useMap: 1,
    repeat: new THREE.Vector2(-3, 1),
    lineWidth: 1,
    resolution: new THREE.Vector2(size.current.width, size.current.height),
  });

  $effect.pre(() => {
    const t = $texture;
    if (!t) return;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    material.map = t;
    material.lineWidth = 1;
    material.depthTest = false;
    material.resolution.set(size.current.width, size.current.height);
  });

  let type: "dynamic" | "kinematicPosition" = $state("dynamic");
  let next = $state(1);
  let last = $state(1);

  function handlePointerMove(e: PointerEvent) {
    const canvas = (e.target as HTMLElement)?.closest("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function handlePointerUp() {
    dragged = false;
    type = "dynamic";
    next = -last;
    last = next;
  }
</script>

<svelte:window
  on:pointermove={handlePointerMove}
  on:pointerup={handlePointerUp}
/>

<T.PerspectiveCamera makeDefault position={[0, 0, 13]} fov={25} />

<T.Group position={[0, 4, 0]}>
  <RigidBody
    type="fixed"
    linearDamping={2}
    angularDamping={2}
    bind:rigidBody={fixed}
  />

  <T.Group position={[0.5, 0, 0]}>
    <RigidBody bind:rigidBody={j1} linearDamping={2} angularDamping={2}>
      <Collider shape="ball" args={[0.1]} />
    </RigidBody>
  </T.Group>

  <T.Group position={[1, 0, 0]}>
    <RigidBody bind:rigidBody={j2} linearDamping={2} angularDamping={2}>
      <Collider shape="ball" args={[0.1]} />
    </RigidBody>
  </T.Group>

  <T.Group position={[1.5, 0, 0]}>
    <RigidBody bind:rigidBody={j3} linearDamping={2} angularDamping={2}>
      <Collider shape="ball" args={[0.1]} />
    </RigidBody>
  </T.Group>

  <T.Group position={[2, 0, 0]}>
    <RigidBody
      {type}
      linearDamping={2}
      angularDamping={2}
      bind:rigidBody={card}
    >
      <Collider shape="cuboid" args={[0.8, 1.125, 0.01]} />

      {#if $gltf}
        <T.Group
          scale={2.25}
          position={[0, -1.2, -0.05]}
          onpointerenter={() => (hovered = true)}
          onpointerleave={() => (hovered = false)}
        >
          <T.Mesh
            geometry={$gltf.nodes.card.geometry}
            onpointerdown={(e: any) => {
              dragged = true;
              type = "kinematicPosition";
              if (!card) return;
              const pos = card.translation();
              drag.set(e.point.x - pos.x, e.point.y - pos.y, e.point.z - pos.z);
            }}
          >
            <T.MeshPhysicalMaterial
              map={$gltf.materials.base.map}
              map-anisotropy={16}
              clearcoat={1}
              clearcoatRoughness={0.15}
              roughness={0.3}
              metalness={0.5}
            />
          </T.Mesh>

          <T.Mesh
            geometry={$gltf.nodes.clip.geometry}
            material={$gltf.materials.metal}
            material-roughness={0.3}
          />

          <T.Mesh
            geometry={$gltf.nodes.clamp.geometry}
            material={$gltf.materials.metal}
          />
        </T.Group>
      {/if}
    </RigidBody>
  </T.Group>
</T.Group>

<T.Mesh {geometry} {material} />
