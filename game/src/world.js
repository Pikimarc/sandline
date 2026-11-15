// SANDLINE compound: a walled desert outpost, 64 x 48 m. Two bombsites — the
// warehouse (A, north-west) and the fuel depot (B, south-east) — joined by a west
// lane, an east lane and a market courtyard in the middle. Every solid is a box
// (or a cylinder boxed in) that blocks movement and stops bullets.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createTextures } from './textures.js';

// [width, height, depth, x, y, z, material] — y is the box centre height.
const BOXES = [
  // ground slab (top at y = 0) and the four perimeter walls, 5 m high
  [64.6, 0.4, 48.6, 0, -0.2, 0, 'sand'],
  [0.6, 5, 48.6, -32.3, 2.5, 0, 'plaster'],
  [0.6, 5, 48.6, 32.3, 2.5, 0, 'plaster'],
  [64.6, 5, 0.6, 0, 2.5, -24.3, 'plaster'],
  [64.6, 5, 0.6, 0, 2.5, 24.3, 'plaster'],
  // Site A warehouse: back wall and two side walls, open to the south
  [16, 4.2, 0.6, -20, 2.1, -20.5, 'terra'],
  [0.6, 4.2, 8.6, -28.2, 2.1, -16.2, 'terra'],
  [0.6, 4.2, 8.6, -11.8, 2.1, -16.2, 'terra'],
  // Site A crates inside the warehouse
  [1.8, 1.8, 1.8, -25.5, 0.9, -18.5, 'wood'],
  [1.2, 1.2, 1.2, -25.5, 2.4, -18.5, 'wood'],
  [1.8, 1.8, 1.8, -14.5, 0.9, -18.5, 'wood'],
  [1.2, 1.2, 1.2, -17.5, 0.6, -13.5, 'wood'],
  // watchtower, a solid terra block with a cap, north-east of mid
  [4, 7, 4, 18, 3.5, -16, 'terra'],
  [4.8, 0.5, 4.8, 18, 7.2, -16, 'plaster'],
  // market stalls across the middle: counter + awning post pairs
  [2.6, 1.1, 1.4, -6, 0.55, 2, 'wood'],
  [2.6, 1.1, 1.4, 0, 0.55, -2, 'wood'],
  [2.6, 1.1, 1.4, 6, 0.55, 2, 'wood'],
  [0.18, 1.6, 0.18, -7.2, 1.9, 2, 'wood'],
  [0.18, 1.6, 0.18, -4.8, 1.9, 2, 'wood'],
  [0.18, 1.6, 0.18, -1.2, 1.9, -2, 'wood'],
  [0.18, 1.6, 0.18, 1.2, 1.9, -2, 'wood'],
  [0.18, 1.6, 0.18, 4.8, 1.9, 2, 'wood'],
  [0.18, 1.6, 0.18, 7.2, 1.9, 2, 'wood'],
  // low stone well in the courtyard, jumpable cover
  [3, 0.9, 3, 0, 0.45, 7, 'plaster'],
  // raised loading platform, jumpable, north of mid
  [6, 0.5, 3, -8, 0.25, -8, 'wood'],
  // crates scattered for cover on the lanes and in the open
  [1.8, 1.8, 1.8, -26, 0.9, 8, 'wood'],
  [1.2, 1.2, 1.2, -26, 2.4, 8, 'wood'],
  [1.8, 1.8, 1.8, -28, 0.9, -6, 'wood'],
  [1.2, 1.2, 1.2, -22, 0.6, -2, 'wood'],
  [1.8, 1.8, 1.8, 26, 0.9, -2, 'wood'],
  [1.2, 1.2, 1.2, 28, 0.6, 6, 'wood'],
  [1.8, 1.8, 1.8, 24, 0.9, -12, 'wood'],
  [1.2, 1.2, 1.2, -12, 0.6, 10, 'wood'],
  [1.8, 1.8, 1.8, 12, 0.9, 12, 'wood'],
  [1.2, 1.2, 1.2, 12, 0.6, -10, 'wood'],
  [1.8, 1.8, 1.8, -4, 0.9, -14, 'wood'],
  [1.2, 1.2, 1.2, 8, 0.6, 16, 'wood'],
  // sandbag walls: low, crouch behind them
  [3.2, 1.05, 0.9, -14, 0.52, 6, 'sand'],
  [3.2, 1.05, 0.9, 14, 0.52, -4, 'sand'],
  [0.9, 1.05, 3.2, -2, 0.52, 14, 'sand'],
  [0.9, 1.05, 3.2, 10, 0.52, -12, 'sand'],
  // Site B: low depot walls forming a corner, open to the north-west
  [10, 1.6, 0.6, 22, 0.8, 21.5, 'metal'],
  [0.6, 1.6, 8, 27.2, 0.8, 17.5, 'metal'],
  [1.8, 1.8, 1.8, 16, 0.9, 20, 'wood'],
];

// [radius, height, x, z, material] — cylinders, boxed in for collision.
const CYLINDERS = [
  [2.1, 3.6, 22, 14, 'metal'],
  [1.7, 2.8, 26.5, 18.5, 'metal'],
  [0.5, 1.15, -20, -10, 'metal'],
  [0.5, 1.15, 14, 8, 'metal'],
  [0.5, 1.15, -14, 14, 'metal'],
];

export const SITES = {
  A: { name: 'A', center: new THREE.Vector3(-20, 0, -16), halfX: 4, halfZ: 3.5, color: 'teal' },
  B: { name: 'B', center: new THREE.Vector3(22, 0, 16), halfX: 4, halfZ: 3.5, color: 'accent' },
};

export const PLAYER_SPAWN = new THREE.Vector3(0, 0, 20);

export const ENEMY_SPAWNS = [
  new THREE.Vector3(-20, 0, -12),
  new THREE.Vector3(22, 0, 12),
  new THREE.Vector3(0, 0, -6),
  new THREE.Vector3(-26, 0, 4),
  new THREE.Vector3(26, 0, -8),
];

// Patrol loops, one per enemy, in the same order as ENEMY_SPAWNS.
export const PATROLS = [
  [[-20, -12], [-14, -16], [-26, -16], [-20, -8]],
  [[22, 12], [26, 18], [16, 18], [22, 8]],
  [[0, -6], [-8, 2], [8, 2], [0, -10]],
  [[-26, 4], [-28, -6], [-24, 12], [-28, 16]],
  [[26, -8], [28, 2], [24, -16], [28, -18]],
];

export function createWorld(scene, seed) {
  const textures = createTextures(seed);
  const group = new THREE.Group();
  scene.add(group);

  const materials = {
    sand: new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.96, metalness: 0 }),
    plaster: new THREE.MeshStandardMaterial({ map: textures.plaster, roughness: 0.9, metalness: 0 }),
    terra: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.terra), roughness: 0.88, metalness: 0 }),
    wood: new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.85, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ map: textures.metal, roughness: 0.55, metalness: 0.5 }),
  };

  const colliders = [];
  const shootables = [];

  function addBox(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  function addCylinder(radius, height, x, z, material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), materials[material]);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3(
      new THREE.Vector3(x - radius, 0, z - radius),
      new THREE.Vector3(x + radius, height, z + radius),
    ));
    shootables.push(mesh);
    return mesh;
  }

  for (const spec of BOXES) addBox(spec[0], spec[1], spec[2], spec[3], spec[4], spec[5], spec[6]);
  for (const spec of CYLINDERS) addCylinder(spec[0], spec[1], spec[2], spec[3], spec[4]);

  // distant dunes outside the walls, silhouettes on the horizon (no collision)
  const duneMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.sand), roughness: 1 });
  const duneSpots = [[-52, -30, 22, 7], [48, -38, 26, 9], [-46, 34, 24, 6], [52, 30, 20, 8], [0, -52, 30, 10], [0, 52, 28, 7], [-58, 0, 18, 6], [58, -6, 22, 9]];
  for (const [x, z, w, h] of duneSpots) {
    const dune = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10), duneMaterial);
    dune.position.set(x, h / 2 - 0.5, z);
    dune.rotation.y = (x * 7 + z * 13) % 0.6;
    group.add(dune);
  }

  // bombsite markers: a flat tinted plane and two beacon poles each
  const siteMarkers = {};
  for (const key of Object.keys(SITES)) {
    const site = SITES[key];
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(site.halfX * 2, site.halfZ * 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE[site.color]), transparent: true, opacity: 0.22, depthWrite: false }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(site.center.x, 0.03, site.center.z);
    group.add(marker);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.6 });
    const tipMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE[site.color]) });
    const poles = [];
    for (const [px, pz] of [[-site.halfX, -site.halfZ], [site.halfX, site.halfZ]]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), poleMaterial);
      pole.position.set(site.center.x + px, 1.3, site.center.z + pz);
      pole.castShadow = true;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), tipMaterial);
      tip.position.set(site.center.x + px, 2.75, site.center.z + pz);
      group.add(pole, tip);
      poles.push(pole);
      colliders.push(new THREE.Box3().setFromObject(pole));
    }
    siteMarkers[key] = { marker, poles };
  }

  // Light: a low golden sun, a cool sky fill, and a warm haze.
  const sky = new THREE.HemisphereLight(new THREE.Color(PALETTE.sky), new THREE.Color(PALETTE.sand), 0.95);
  scene.add(sky);

  const sun = new THREE.DirectionalLight(new THREE.Color('#ffe0b0'), 2.6);
  sun.position.set(30, 42, 20);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -38;
  sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 38;
  sun.shadow.camera.bottom = -38;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.sky), 0.5);
  fill.position.set(-24, 18, -28);
  scene.add(fill);

  return { colliders, shootables, group, siteMarkers };
}
