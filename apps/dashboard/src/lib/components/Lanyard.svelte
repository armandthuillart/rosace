<script lang="ts">
  import { T, useThrelte, useTask } from "@threlte/core";
  import { useGltf, useTexture, interactivity } from "@threlte/extras";
  import { MeshLineGeometry, MeshLineMaterial } from "meshline";
  import {
    RigidBody,
    Collider,
    useRopeJoint,
    useSphericalJoint,
  } from "@threlte/rapier";
  import * as THREE from "three";
  import type { RigidBody as RapierRigidBody } from "@dimforge/rapier3d-compat";
  import { page } from "$app/state";
  import { isDarkMode } from "$lib/stores/theme";

  interactivity();

  let { user } = page.data;

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
    drag = new THREE.Vector3(),
    quat = new THREE.Quaternion(),
    euler = new THREE.Euler();

  const gltf = useGltf($isDarkMode ? "/tag-dark.glb" : "/tag-light.glb");
  const band = useTexture($isDarkMode ? "/band-dark.jpg" : "/band-light.jpg");

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);

  let dragged = $state(false);
  let hovered = $state(false);
  let texture = $state<THREE.CanvasTexture | null>(null);

  function dynamic(base: THREE.Texture) {
    const size = 1024;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(base.image as CanvasImageSource, 0, 0, size, size);

    ctx.font = "600 43px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = $isDarkMode ? "white" : "black";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(user!.lastName, 31, 567);
    ctx.fillText(user!.firstName, 31, 523);

    const t = new THREE.CanvasTexture(c);
    t.flipY = false;
    t.anisotropy = 16;
    t.colorSpace = base.colorSpace;
    t.needsUpdate = true;
    return t;
  }

  $effect(() => {
    const map = $gltf?.materials?.base?.map;
    if (!map || !map.image) return;

    texture = dynamic(map);
  });

  let joint = useSphericalJoint([0, 0, 0], [0, 1.5, 0]),
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

  useTask((delta) => {
    material.resolution.set(size.current.width, size.current.height);
    // Makes the drag point three dimensional.
    if (dragged) {
      vec.set(ndc.x, ndc.y, 0.5).unproject(camera.current);
      dir.copy(vec).sub(camera.current.position).normalize();
      vec.add(dir.multiplyScalar(camera.current.position.length()));
      const t = { x: vec.x - drag.x, y: vec.y - drag.y, z: vec.z - drag.z };
      card?.setNextKinematicTranslation(t);
    }
    // Fix most of the jitter when over pulling the card.
    if (j1) {
      const t = j1.translation();
      const d = j1Lerp.distanceTo(vec.set(t.x, t.y, t.z));
      const c = Math.max(0.1, Math.min(1, d));
      j1Lerp.lerp(vec, delta * (10 + c * 40));
    }
    if (j2) {
      const t = j2.translation();
      const d = j2Lerp.distanceTo(vec.set(t.x, t.y, t.z));
      const c = Math.max(0.1, Math.min(1, d));
      j2Lerp.lerp(vec, delta * (10 + c * 40));
    }
    // Calculate catmul curve.
    if (!card || !j1 || !j3 || !fixed) return;
    curve.points[0].copy(j3.translation());
    curve.points[1].copy(j2Lerp);
    curve.points[2].copy(j1Lerp);
    curve.points[3].copy(fixed.translation());
    geometry.setPoints(curve.getPoints(32));
    // Tilt it back towards the screen.
    ang.copy(card.angvel());
    const r = card.rotation();
    euler.setFromQuaternion(quat.set(r.x, r.y, r.z, r.w));
    const vel = { x: ang.x, y: ang.y - next * euler.y * 0.25, z: ang.z };
    card.setAngvel(vel, true);
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
    const b = $band;
    if (!b) return;

    b.colorSpace = THREE.SRGBColorSpace;
    b.needsUpdate = true;
    b.wrapS = b.wrapT = THREE.RepeatWrapping;

    material.map = b;
    material.useMap = 1;
    material.lineWidth = 1;
    material.depthTest = false;
    material.toneMapped = false;
    material.resolution.set(size.current.width, size.current.height);
    material.needsUpdate = true;
  });

  let type: "dynamic" | "kinematicPosition" = $state("dynamic");
  let next = $state(1);
  let last = $state(1);

  function handlePointerMove(e: PointerEvent) {
    const c = (e.target as HTMLElement).closest("canvas");
    if (!c) return;

    const r = c.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
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

<T.PerspectiveCamera fov={25} position={[0, 0, 13]} makeDefault />

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

      {#if $gltf && texture}
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
              map={texture}
              clearcoat={1}
              roughness={0.3}
              metalness={0.5}
              iridescence={1}
              iridescenceIOR={1}
              map-anisotropy={16}
              clearcoatRoughness={0.15}
              iridescenceThicknessRange={[0, 2400]}
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
