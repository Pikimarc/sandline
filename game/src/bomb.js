// The bomb: the objective beyond killing. Each round names one active site;
// hold E inside it for three seconds to plant, then the bomb ticks for 35
// seconds while the defenders converge to defuse it. An explosion wins the
// round; a defuse, or the round timer running out first, loses it.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { SITES } from './world.js';

export const PLANT_TIME = 3;
export const BOMB_TIME = 35;

export function createBomb(scene, siteMarkers) {
  const bombGroup = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.32, 0.36),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.4 }),
  );
  body.position.y = 0.16;
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }),
  );
  lamp.position.set(0, 0.36, 0);
  const light = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 4);
  light.position.set(0, 0.5, 0);
  bombGroup.add(body, lamp, light);
  bombGroup.visible = false;
  scene.add(bombGroup);

  const state = {
    activeSite: 'A',
    planted: false,
    exploded: false,
    defused: false,
    plantProgress: 0,
    timer: 0,
    beep: 0,
  };

  function setSiteMarker(siteKey, active) {
    const marker = siteMarkers[siteKey];
    if (!marker) return;
    marker.marker.material.opacity = active ? 0.45 : 0.12;
  }

  function inSite(position, siteKey) {
    const site = SITES[siteKey];
    return Math.abs(position.x - site.center.x) <= site.halfX
      && Math.abs(position.z - site.center.z) <= site.halfZ;
  }

  return {
    state,
    // hold-to-plant: returns the plant progress 0..1; planting completes the bomb
    plantTick(dt, playerPosition, holding) {
      if (state.planted || state.exploded || state.defused) return state.plantProgress;
      if (holding && inSite(playerPosition, state.activeSite)) {
        state.plantProgress = Math.min(1, state.plantProgress + dt / PLANT_TIME);
        if (state.plantProgress >= 1) {
          state.planted = true;
          state.timer = BOMB_TIME;
          const site = SITES[state.activeSite];
          bombGroup.position.set(site.center.x, 0, site.center.z);
          bombGroup.visible = true;
        }
      } else {
        state.plantProgress = Math.max(0, state.plantProgress - dt / 1.5);
      }
      return state.plantProgress;
    },
    step(dt, onExplode, onBeep) {
      if (!state.planted || state.exploded || state.defused) return;
      state.timer -= dt;
      state.beep -= dt;
      const fast = state.timer < 10;
      if (state.beep <= 0) {
        state.beep = fast ? 0.5 : 1;
        light.intensity = 14;
        onBeep();
      } else {
        light.intensity = Math.max(0, light.intensity - dt * 30);
      }
      lamp.material.color.setHex(fast ? 0xff3020 : 0xe8833a);
      if (state.timer <= 0) {
        state.exploded = true;
        bombGroup.visible = false;
        onExplode();
      }
    },
    position() {
      if (!state.planted || state.exploded || state.defused) return null;
      return bombGroup.position;
    },
    inActiveSite(position) {
      return inSite(position, state.activeSite);
    },
    defuse() {
      if (!state.planted) return;
      state.defused = true;
      bombGroup.visible = false;
    },
    reset(siteKey) {
      state.activeSite = siteKey;
      state.planted = false;
      state.exploded = false;
      state.defused = false;
      state.plantProgress = 0;
      state.timer = 0;
      state.beep = 0;
      bombGroup.visible = false;
      setSiteMarker('A', siteKey === 'A');
      setSiteMarker('B', siteKey === 'B');
    },
  };
}
