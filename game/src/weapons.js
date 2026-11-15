// Three weapons, one owner. The rifle and the SMG are automatic, the pistol is
// semi-automatic (one shot per click). Each keeps its own magazine and reserve;
// the buy menu owns the prices, this module owns the numbers and the view models.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  rifle: {
    name: 'VK-7 Rifle', price: 2700, magSize: 30, reserve: 120, fireGap: 0.105,
    reloadTime: 2.0, damage: 34, headDamage: 100, spreadStill: 0.0022, spreadMoving: 0.03,
    recoil: 0.011, auto: true,
  },
  smg: {
    name: 'Scorpion SMG', price: 1500, magSize: 25, reserve: 100, fireGap: 0.07,
    reloadTime: 1.7, damage: 26, headDamage: 78, spreadStill: 0.004, spreadMoving: 0.034,
    recoil: 0.008, auto: true,
  },
  pistol: {
    name: 'P9 Sidearm', price: 0, magSize: 12, reserve: 48, fireGap: 0.2,
    reloadTime: 1.4, damage: 28, headDamage: 84, spreadStill: 0.003, spreadMoving: 0.02,
    recoil: 0.014, auto: false,
  },
};

const MUZZLE_TIME = 0.06;
const SWITCH_TIME = 0.35;

function box(w, h, d, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export function createWeapons(camera) {
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.55, metalness: 0.4 });
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.wood), roughness: 0.8, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.metal), roughness: 0.4, metalness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.2 });

  function rifleModel() {
    const group = new THREE.Group();
    group.add(box(0.09, 0.11, 0.46, 0, 0, 0, dark));
    group.add(box(0.05, 0.05, 0.42, 0, 0.03, -0.42, steel));
    group.add(box(0.08, 0.09, 0.24, 0, -0.02, 0.32, grip));
    group.add(box(0.06, 0.12, 0.1, 0, -0.08, -0.05, grip));
    group.add(box(0.03, 0.04, 0.08, 0, 0.08, -0.12, accent));
    return group;
  }

  function smgModel() {
    const group = new THREE.Group();
    group.add(box(0.08, 0.1, 0.34, 0, 0, 0, dark));
    group.add(box(0.045, 0.045, 0.24, 0, 0.02, -0.28, steel));
    group.add(box(0.05, 0.16, 0.08, 0, -0.11, 0.02, grip));
    group.add(box(0.07, 0.08, 0.16, 0, -0.02, 0.24, grip));
    group.add(box(0.05, 0.03, 0.1, 0, 0.06, -0.05, accent));
    return group;
  }

  function pistolModel() {
    const group = new THREE.Group();
    group.add(box(0.06, 0.09, 0.26, 0, 0, -0.04, dark));
    group.add(box(0.05, 0.13, 0.08, 0, -0.09, 0.05, grip));
    group.add(box(0.02, 0.03, 0.05, 0, 0.055, -0.1, accent));
    return group;
  }

  const models = { rifle: rifleModel(), smg: smgModel(), pistol: pistolModel() };
  for (const key of Object.keys(models)) {
    models[key].position.set(0.24, -0.2, -0.42);
    models[key].visible = false;
    camera.add(models[key]);
  }
  models.pistol.visible = true;

  // a small diamond flash at the muzzle, shown for one frame per shot
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.17, -0.95);
  flash.rotation.z = Math.PI / 4;
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 6);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const state = {
    slot: 'pistol',
    primary: null, // 'rifle' | 'smg' | null
    ammo: {
      rifle: { mag: WEAPONS.rifle.magSize, reserve: WEAPONS.rifle.reserve, owned: false },
      smg: { mag: WEAPONS.smg.magSize, reserve: WEAPONS.smg.reserve, owned: false },
      pistol: { mag: WEAPONS.pistol.magSize, reserve: WEAPONS.pistol.reserve, owned: true },
    },
    cooldown: 0,
    reloadLeft: 0,
    switchLeft: 0,
    flash: 0,
    kick: 0,
    bobPhase: 0,
  };

  function currentDef() {
    return WEAPONS[state.slot];
  }

  function currentAmmo() {
    return state.ammo[state.slot];
  }

  function showModel() {
    for (const key of Object.keys(models)) models[key].visible = key === state.slot;
  }

  function step(dt, speed, airborne) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    state.switchLeft = Math.max(0, state.switchLeft - dt);
    const model = models[state.slot];
    // walk bob, stronger when moving, none while airborne
    state.bobPhase += dt * (4 + speed * 1.6);
    const bob = airborne ? 0 : Math.min(1, speed / 5) * 0.012;
    model.position.set(
      0.24 + Math.sin(state.bobPhase) * bob,
      -0.2 + Math.abs(Math.cos(state.bobPhase)) * bob * 0.8,
      -0.42 + state.kick,
    );
    model.rotation.x = state.kick * 2.4;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.6 * Math.min(1, (currentDef().reloadTime - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const def = currentDef();
        const ammo = currentAmmo();
        const take = Math.min(def.magSize - ammo.mag, ammo.reserve);
        ammo.mag += take;
        ammo.reserve -= take;
      }
    }
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
  }

  return {
    state,
    step,
    def: currentDef,
    ammo: currentAmmo,
    ready() {
      return currentAmmo().mag > 0 && state.cooldown === 0 && state.reloadLeft === 0 && state.switchLeft === 0;
    },
    pullTrigger() {
      state.cooldown = currentDef().fireGap;
      state.flash = MUZZLE_TIME;
      state.kick = 0.055;
    },
    takeRound() {
      if (currentAmmo().mag <= 0) return false;
      currentAmmo().mag -= 1;
      return true;
    },
    reload() {
      const def = currentDef();
      const ammo = currentAmmo();
      if (state.reloadLeft > 0 || ammo.mag === def.magSize || ammo.reserve === 0) return;
      state.reloadLeft = def.reloadTime;
    },
    spread(speed) {
      const def = currentDef();
      return def.spreadStill + Math.min(1, speed / 5.4) * def.spreadMoving;
    },
    select(slot) {
      if (slot === state.slot || state.switchLeft > 0) return false;
      if (slot === 'primary') {
        if (!state.primary) return false;
        state.slot = state.primary;
      } else if (slot === 'pistol') {
        state.slot = 'pistol';
      } else {
        return false;
      }
      state.switchLeft = SWITCH_TIME;
      state.reloadLeft = 0;
      showModel();
      return true;
    },
    // buy a primary weapon; returns true when the money was taken (caller checks funds)
    buyPrimary(kind) {
      const ammo = state.ammo[kind];
      ammo.owned = true;
      ammo.mag = WEAPONS[kind].magSize;
      ammo.reserve = WEAPONS[kind].reserve;
      state.primary = kind;
      state.slot = kind;
      state.reloadLeft = 0;
      state.cooldown = 0;
      showModel();
    },
    refillOwned() {
      for (const key of Object.keys(state.ammo)) {
        if (state.ammo[key].owned) {
          state.ammo[key].mag = WEAPONS[key].magSize;
          state.ammo[key].reserve = WEAPONS[key].reserve;
        }
      }
      if (!state.primary) state.slot = 'pistol';
      else state.slot = state.primary;
      state.reloadLeft = 0;
      state.cooldown = 0;
      showModel();
    },
    reset() {
      state.primary = null;
      state.slot = 'pistol';
      for (const key of Object.keys(state.ammo)) {
        state.ammo[key].owned = key === 'pistol';
        state.ammo[key].mag = WEAPONS[key].magSize;
        state.ammo[key].reserve = WEAPONS[key].reserve;
      }
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.switchLeft = 0;
      state.flash = 0;
      state.kick = 0;
      showModel();
    },
  };
}
