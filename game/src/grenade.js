// Grenades: a thrown sphere that bounces off the map on a fuse, then bursts
// with area damage. The fuse, the bounce and the blast are all simulated at the
// fixed step; the explosion is a flash of light and an expanding shell, then gone.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const GRAVITY = 13;
const FUSE = 2.2;
const BLAST_RADIUS = 6.5;
const BLAST_MAX = 100;
const BLAST_MIN = 20;
const BOUNCE = 0.45;
const RADIUS = 0.14;

export function createGrenades(scene, colliders, hooks) {
  const active = [];
  const blasts = [];
  const next = new THREE.Vector3();
  const sphereGeometry = new THREE.SphereGeometry(RADIUS, 10, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.5 });
  const bandMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) });
  const blastGeometry = new THREE.SphereGeometry(1, 18, 12);

  function throwGrenade(origin, direction) {
    if (active.length >= 4) return false;
    const group = new THREE.Group();
    const body = new THREE.Mesh(sphereGeometry, bodyMaterial);
    const band = new THREE.Mesh(new THREE.TorusGeometry(RADIUS * 0.9, 0.02, 6, 14), bandMaterial);
    band.rotation.x = Math.PI / 2;
    group.add(body, band);
    group.position.copy(origin);
    scene.add(group);
    active.push({
      group,
      velocity: new THREE.Vector3(direction.x * 14, direction.y * 14 + 3.5, direction.z * 14),
      fuse: FUSE,
    });
    return true;
  }

  function hitsWall(x, y, z) {
    for (const collider of colliders) {
      if (x > collider.min.x - RADIUS && x < collider.max.x + RADIUS
        && y > collider.min.y - RADIUS && y < collider.max.y + RADIUS
        && z > collider.min.z - RADIUS && z < collider.max.z + RADIUS) return true;
    }
    return false;
  }

  function explode(item) {
    const center = item.group.position;
    const shell = new THREE.Mesh(
      blastGeometry,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.75, depthWrite: false }),
    );
    shell.position.copy(center);
    shell.scale.setScalar(0.4);
    scene.add(shell);
    const light = new THREE.PointLight(new THREE.Color(PALETTE.accent), 60, 18);
    light.position.copy(center);
    scene.add(light);
    blasts.push({ shell, light, age: 0 });
    hooks.boom(center);
    const falloff = (distance) => BLAST_MAX - ((BLAST_MAX - BLAST_MIN) * Math.min(1, distance / BLAST_RADIUS));
    for (const enemy of hooks.enemies()) {
      if (!enemy.alive) continue;
      const distance = enemy.group.position.distanceTo(center);
      if (distance <= BLAST_RADIUS) hooks.damageEnemy(enemy, falloff(distance));
    }
    const playerDistance = hooks.playerPosition().distanceTo(center);
    if (playerDistance <= BLAST_RADIUS) hooks.damagePlayer(Math.round(falloff(playerDistance) * 0.5));
  }

  function step(dt) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      const item = active[i];
      item.fuse -= dt;
      item.velocity.y -= GRAVITY * dt;
      const pos = item.group.position;
      next.set(
        pos.x + item.velocity.x * dt,
        pos.y + item.velocity.y * dt,
        pos.z + item.velocity.z * dt,
      );
      // axis-separated bounce, damped, so a grenade settles instead of jittering
      if (!hitsWall(next.x, pos.y, pos.z)) pos.x = next.x;
      else item.velocity.x *= -BOUNCE;
      if (!hitsWall(pos.x, next.y, pos.z)) pos.y = next.y;
      else {
        item.velocity.y *= -BOUNCE;
        if (Math.abs(item.velocity.y) < 0.8) item.velocity.y = 0;
      }
      if (!hitsWall(pos.x, pos.y, next.z)) pos.z = next.z;
      else item.velocity.z *= -BOUNCE;
      item.velocity.x *= 0.995;
      item.velocity.z *= 0.995;
      if (pos.y < RADIUS) {
        pos.y = RADIUS;
        item.velocity.y = Math.abs(item.velocity.y) > 0.8 ? -item.velocity.y * BOUNCE : 0;
      }
      if (item.fuse <= 0) {
        explode(item);
        scene.remove(item.group);
        active.splice(i, 1);
      }
    }
    for (let i = blasts.length - 1; i >= 0; i -= 1) {
      const blast = blasts[i];
      blast.age += dt;
      const t = blast.age / 0.4;
      blast.shell.scale.setScalar(0.4 + t * BLAST_RADIUS);
      blast.shell.material.opacity = Math.max(0, 0.75 * (1 - t));
      blast.light.intensity = Math.max(0, 60 * (1 - t));
      if (t >= 1) {
        scene.remove(blast.shell);
        scene.remove(blast.light);
        blast.shell.material.dispose();
        blasts.splice(i, 1);
      }
    }
  }

  return {
    throwGrenade,
    step,
    count() {
      return active.length;
    },
    reset() {
      for (const item of active) scene.remove(item.group);
      active.length = 0;
      for (const blast of blasts) {
        scene.remove(blast.shell);
        scene.remove(blast.light);
      }
      blasts.length = 0;
    },
  };
}
