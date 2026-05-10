<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf, useTexture } from "@threlte/extras";
  import { MeshLineGeometry, MeshLineMaterial } from "meshline";
  import {
    RigidBody,
    Collider,
    useRopeJoint,
    useSphericalJoint,
    usePhysicsTask,
  } from "@threlte/rapier";
  import * as THREE from "three";

  const { camera, scene, renderer, size } = useThrelte();

  $effect(() => {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color("black");

    const geo = new THREE.PlaneGeometry(1, 1);
    const lightformers: [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ][] = [
      [2, 0, -1, 5, 0, 0, Math.PI / 3],
      [3, -1, -1, 1, 0, 0, Math.PI / 3],
      [3, 1, 1, 1, 0, 0, Math.PI / 3],
      [10, -25, 5, 30, 0, Math.PI / 2, Math.PI / 3],
    ];
    const lightformerScales: [number, number][] = [
      [100, 0.1],
      [100, 0.1],
      [100, 0.1],
      [100, 15],
    ];

    for (let i = 0; i < lightformers.length; i++) {
      const [intensity, px, py, pz, rx, ry, rz] = lightformers[i];
      const [sx, sy] = lightformerScales[i];
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(intensity, intensity, intensity),
          toneMapped: false,
        }),
      );
      mesh.position.set(px, py, pz);
      mesh.rotation.set(rx, ry, rz);
      mesh.scale.set(sx, sy, 1);
      envScene.add(mesh);
    }

    const fbo = new THREE.WebGLCubeRenderTarget(1024);
    fbo.texture.type = THREE.HalfFloatType;
    const cubeCamera = new THREE.CubeCamera(0.1, 100, fbo);

    const autoClear = renderer.autoClear;
    renderer.autoClear = true;
    cubeCamera.update(renderer, envScene);
    renderer.autoClear = autoClear;

    for (const child of envScene.children) {
      const mat = (child as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
    geo.dispose();

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromCubemap(fbo.texture).texture;
    pmremGenerator.dispose();

    scene.environment = envMap;
    scene.background = fbo.texture;
    scene.backgroundBlurriness = 0.75;

    return () => {
      envMap.dispose();
      fbo.texture.dispose();
      fbo.dispose();
      scene.environment = null;
      scene.background = null;
    };
  });

  const gltf = useGltf<{
    nodes: Record<string, any>;
    materials: Record<string, any>;
  }>("/tag.glb");
  const bandTex = useTexture("/band.jpg");

  const bandGeometry = new MeshLineGeometry();
  const bandMaterial = new MeshLineMaterial({
    color: new THREE.Color("white"),
    lineWidth: 1,
    resolution: new THREE.Vector2(size.current.width, size.current.height),
    useMap: 0,
  });

  $effect.pre(() => {
    const tex = $bandTex;
    if (!tex) return;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    bandMaterial.map = tex;
    bandMaterial.useMap = 1;
    bandMaterial.repeat.set(-3, 1);
  });

  $effect.pre(() => {
    bandMaterial.resolution.set($size.width, $size.height);
  });

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  curve.curveType = "chordal";

  const rope1 = useRopeJoint([0, 0, 0], [0, 0, 0], 1);
  const rope2 = useRopeJoint([0, 0, 0], [0, 0, 0], 1);
  const rope3 = useRopeJoint([0, 0, 0], [0, 0, 0], 1);
  const cardJoint = useSphericalJoint([0, 0, 0], [0, 1.5, 0]);

  let fixedBody: any = $state();
  let j1Body: any = $state();
  let j2Body: any = $state();
  let j3Body: any = $state();
  let cardBody: any = $state();

  let cardGroup: THREE.Group | undefined = $state();
  let isDragging = $state(false);
  let isHovered = $state(false);
  let cardType: "dynamic" | "kinematicPosition" = $state("dynamic");

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const dragOffset = new THREE.Vector3();
  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  const maxSpeed = 50;
  const minSpeed = 10;
  const j1Lerped = new THREE.Vector3();
  const j2Lerped = new THREE.Vector3();
  let j1LerpedInitialized = false;
  let j2LerpedInitialized = false;

  $effect(() => {
    if (fixedBody && j1Body) {
      rope1.rigidBodyA.set(fixedBody);
      rope1.rigidBodyB.set(j1Body);
    }
  });

  $effect(() => {
    if (j1Body && j2Body) {
      rope2.rigidBodyA.set(j1Body);
      rope2.rigidBodyB.set(j2Body);
    }
  });

  $effect(() => {
    if (j2Body && j3Body) {
      rope3.rigidBodyA.set(j2Body);
      rope3.rigidBodyB.set(j3Body);
    }
  });

  $effect(() => {
    if (j3Body && cardBody) {
      cardJoint.rigidBodyA.set(j3Body);
      cardJoint.rigidBodyB.set(cardBody);
    }
  });

  $effect(() => {
    document.body.style.cursor = isDragging
      ? "grabbing"
      : isHovered
        ? "grab"
        : "auto";
  });

  usePhysicsTask((delta) => {
    if (!j3Body || !j2Body || !j1Body || !fixedBody || !cardBody) return;

    if (isDragging) {
      vec.set(pointerNdc.x, pointerNdc.y, 0.5).unproject(camera.current);
      dir.copy(vec).sub(camera.current.position).normalize();
      vec.add(dir.multiplyScalar(camera.current.position.length()));
      cardBody.setNextKinematicTranslation({
        x: vec.x - dragOffset.x,
        y: vec.y - dragOffset.y,
        z: vec.z - dragOffset.z,
      });
      fixedBody.wakeUp?.();
      j1Body.wakeUp?.();
      j2Body.wakeUp?.();
      j3Body.wakeUp?.();
      cardBody.wakeUp?.();
    }

    if (!j1LerpedInitialized && j1Body) {
      j1Lerped.copy(j1Body.translation());
      j1LerpedInitialized = true;
    }
    if (!j2LerpedInitialized && j2Body) {
      j2Lerped.copy(j2Body.translation());
      j2LerpedInitialized = true;
    }

    if (j1Body && j1LerpedInitialized) {
      const j1t = j1Body.translation();
      const clampedDist1 = Math.max(0.1, Math.min(1, j1Lerped.distanceTo(j1t)));
      j1Lerped.lerp(
        j1t,
        delta * (minSpeed + clampedDist1 * (maxSpeed - minSpeed)),
      );
    }
    if (j2Body && j2LerpedInitialized) {
      const j2t = j2Body.translation();
      const clampedDist2 = Math.max(0.1, Math.min(1, j2Lerped.distanceTo(j2t)));
      j2Lerped.lerp(
        j2t,
        delta * (minSpeed + clampedDist2 * (maxSpeed - minSpeed)),
      );
    }

    ang.copy(cardBody.angvel());
    rot.copy(cardBody.rotation());
    cardBody.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });

    curve.points[0].copy(j3Body.translation());
    curve.points[1].copy(j2LerpedInitialized ? j2Lerped : j2Body.translation());
    curve.points[2].copy(j1LerpedInitialized ? j1Lerped : j1Body.translation());
    curve.points[3].copy(fixedBody.translation());

    bandGeometry.setPoints(curve.getPoints(32));
  });

  function handlePointerDown(e: PointerEvent) {
    if (!cardGroup || !cardBody) return;
    const canvas = (e.target as HTMLElement).closest("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera.current);
    const hits = raycaster.intersectObjects(cardGroup.children, true);
    if (hits.length > 0) {
      isDragging = true;
      cardType = "kinematicPosition";
      const hit = hits[0].point;
      const bodyPos = new THREE.Vector3(
        cardBody.translation().x,
        cardBody.translation().y,
        cardBody.translation().z,
      );
      dragOffset.copy(hit).sub(bodyPos);
    }
  }

  function handlePointerMove(e: PointerEvent) {
    const canvas = (e.target as HTMLElement).closest("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (isDragging) return;

    if (cardGroup && cardBody) {
      raycaster.setFromCamera(pointerNdc, camera.current);
      const hits = raycaster.intersectObjects(cardGroup.children, true);
      isHovered = hits.length > 0;
    }
  }

  function handlePointerUp() {
    isDragging = false;
    cardType = "dynamic";
  }
</script>

<svelte:window
  on:pointerdown={handlePointerDown}
  on:pointerup={handlePointerUp}
  on:pointermove={handlePointerMove}
/>

<T.PerspectiveCamera makeDefault position={[0, 0, 13]} fov={25} />

<T.AmbientLight intensity={Math.PI} />

<T.Mesh geometry={bandGeometry} material={bandMaterial} />

<T.Group position={[0, 4, 0]}>
  <RigidBody bind:rigidBody={fixedBody} type="fixed" />

  <T.Group position={[0.5, 0, 0]}>
    <RigidBody bind:rigidBody={j1Body} linearDamping={2} angularDamping={2}>
      <Collider shape="ball" args={[0.1]} />
    </RigidBody>
  </T.Group>

  <T.Group position={[1, 0, 0]}>
    <RigidBody bind:rigidBody={j2Body} linearDamping={2} angularDamping={2}>
      <Collider shape="ball" args={[0.1]} />
    </RigidBody>
  </T.Group>

  <T.Group position={[1.5, 0, 0]}>
    <RigidBody bind:rigidBody={j3Body} linearDamping={2} angularDamping={2}>
      <Collider shape="ball" args={[0.1]} />
    </RigidBody>
  </T.Group>

  <T.Group position={[2, 0, 0]}>
    <RigidBody
      bind:rigidBody={cardBody}
      type={cardType}
      linearDamping={2}
      angularDamping={2}
    >
      <Collider shape="cuboid" args={[0.8, 1.125, 0.01]} />

      {#if $gltf}
        <T.Group bind:ref={cardGroup} scale={2.25} position={[0, -1.2, -0.05]}>
          <T.Mesh geometry={$gltf.nodes.card.geometry}>
            <T.MeshPhysicalMaterial
              map={$gltf.materials.base.map}
              map-anisotropy={16}
              clearcoat={1}
              clearcoatRoughness={0.15}
              iridescence={1}
              iridescenceIOR={1}
              iridescenceThicknessRange={[0, 2400]}
              metalness={0.5}
              roughness={0.3}
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
