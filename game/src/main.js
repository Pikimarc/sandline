// SANDLINE — boot and the one loop. A fixed 60 Hz simulation feeds a render at
// the display's rate; the game state (rounds, bomb, enemies, weapons) lives in
// one place here, and every module owns exactly one job. ?shot=start|play|end|
// tactics with &seed=N sets up a deterministic frame for a capture, renders it
// twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, PLAYER_SPAWN, ENEMY_SPAWNS, PATROLS } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapons, WEAPONS } from './weapons.js';
import { createGrenades } from './grenade.js';
import { createEnemies } from './enemies.js';
import { createBomb } from './bomb.js';
import { createRounds, BUY_ITEMS, ROUND_TIME } from './rounds.js';
import { createHud } from './hud.js';
import { createSound } from './sound.js';

const FIXED_STEP = 1 / 60;
const PLAYER_HEALTH = 100;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
  // (this three.js version has no PCFSoftShadowMap; PCFShadowMap is the
  // softest shadow mode it still ships)
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.sky), 45, 115);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 220);
scene.add(camera);

const world = createWorld(scene, seed);
const bomb = createBomb(scene, world.siteMarkers);
const rounds = createRounds();
const weapons = createWeapons(camera);
const hud = createHud();
const sound = createSound();
const player = createPlayer(world.colliders);
const input = createInput(renderer.domElement, onLockChange);
const raycaster = new THREE.Raycaster();
raycaster.far = 90;

let health = PLAYER_HEALTH;
let kills = 0;
let elapsed = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let wasFiring = false;

const body = player.state;
const direction = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const hitPoint = new THREE.Vector3();

// one pooled tracer line for the player's own shots
const tracerGeometry = new THREE.BufferGeometry();
tracerGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
const tracer = new THREE.Line(tracerGeometry, new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.85 }));
tracer.visible = false;
tracer.frustumCulled = false;
scene.add(tracer);
let tracerLife = 0;

const enemies = createEnemies(scene, world.colliders, world.shootables, ENEMY_SPAWNS, PATROLS, seed);
const grenades = createGrenades(scene, world.colliders, {
  enemies: () => enemies.items,
  playerPosition: () => body.position,
  damageEnemy: (enemy, amount) => hurtEnemy(enemy, amount, false),
  damagePlayer: (amount) => damagePlayer(amount),
  boom: () => sound.explosion(),
});

function refreshHud() {
  hud.setHealth(health, rounds.state.armor);
  hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve, weapons.def().name);
  hud.setGrenades(rounds.state.grenades);
  hud.setTimer(rounds.state.timer);
  hud.setRound(rounds.state.round, rounds.state.wins, rounds.state.losses);
  hud.setMoney(rounds.state.money);
  const site = bomb.state.activeSite;
  hud.setObjective(bomb.state.planted
    ? `BOMB PLANTED AT SITE ${site} — DEFEND IT`
    : `PLANT THE BOMB AT SITE ${site}`);
}

function showTracer(from, to) {
  const positions = tracer.geometry.attributes.position;
  positions.setXYZ(0, from.x, from.y, from.z);
  positions.setXYZ(1, to.x, to.y, to.z);
  positions.needsUpdate = true;
  tracer.visible = true;
  tracerLife = 0.07;
}

function hurtEnemy(enemy, amount, isHead) {
  if (!enemy.alive) return false;
  const killed = enemies.damage(enemy, amount, body.position);
  if (killed) {
    kills += 1;
    rounds.addKillReward();
    hud.feed(`Enemy down  +$300`);
    hud.setMoney(rounds.state.money);
    sound.hit();
    if (enemies.remaining() === 0 && rounds.state.phase === 'play' && !bomb.state.planted) {
      finishRound(true, 'All defenders eliminated.');
    }
  } else {
    sound.hit();
  }
  return killed;
}

function damagePlayer(amount) {
  if (rounds.state.phase !== 'play') return;
  let rest = amount;
  if (rounds.state.armor > 0) {
    const absorbed = Math.min(rounds.state.armor, rest);
    rounds.state.armor -= absorbed;
    rest -= absorbed;
  }
  health -= rest;
  hud.damageFlash();
  hud.setHealth(health, rounds.state.armor);
  if (health <= 0) {
    health = 0;
    finishRound(false, 'You were eliminated.');
  }
}

function shoot(spread) {
  if (!weapons.takeRound()) {
    sound.dry();
    return false;
  }
  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);
  const shootables = world.shootables.concat(enemies.hitMeshes);
  const hit = raycaster.intersectObjects(shootables, false)[0];
  muzzle.copy(camera.position).addScaledVector(direction, 0.9);
  if (hit) {
    hitPoint.copy(hit.point);
    showTracer(muzzle, hitPoint);
    if (hit.object.userData.enemy) {
      const enemy = hit.object.userData.enemy;
      const isHead = hit.object.userData.part === 'head';
      const def = weapons.def();
      const killed = hurtEnemy(enemy, isHead ? def.headDamage : def.damage, isHead);
      hud.hitMarker(killed, shot ? 4000 : 120);
    }
  } else {
    hitPoint.copy(camera.position).addScaledVector(direction, 60);
    showTracer(muzzle, hitPoint);
  }
  weapons.pullTrigger();
  player.recoil(weapons.def().recoil * (0.8 + random() * 0.4), (random() * 2 - 1) * 0.004);
  sound.shot();
  enemies.hearShot(body.position);
  refreshHud();
  return true;
}

function beginRound() {
  const site = rounds.startRound();
  health = PLAYER_HEALTH;
  bomb.reset(site);
  grenades.reset();
  weapons.refillOwned();
  player.reset(PLAYER_SPAWN.x, PLAYER_SPAWN.z, 0);
  enemies.reset(ENEMY_SPAWNS);
  hud.hideBuy();
  hud.hideOverlay();
  hud.centerMessage(`ROUND ${rounds.state.round} — PLANT AT SITE ${site}`);
  refreshHud();
}

function finishRound(won, reason) {
  if (rounds.state.phase !== 'play') return;
  const result = rounds.endRound(won, reason);
  hud.hidePlant();
  if (document.pointerLockElement) document.exitPointerLock();
  hud.showOverlay(won ? 'won' : 'lost', result);
  refreshHud();
}

function openBuyMenu() {
  rounds.nextRound();
  hud.hideOverlay();
  hud.showBuy(BUY_ITEMS, () => rounds.state.money, buyHandler);
  refreshHud();
}

// one buy handler for every place the menu opens, so a purchase behaves the same
function buyHandler(id) {
  const message = rounds.buy(id, weapons);
  if (message) refreshHud();
  return message;
}

hud.onPlay(() => {
  if (shot) return;
  if (rounds.state.phase === 'end') {
    openBuyMenu();
    return;
  }
  if (rounds.state.phase === 'buy') {
    hud.hideOverlay();
    hud.showBuy(BUY_ITEMS, () => rounds.state.money, buyHandler);
    return;
  }
  sound.unlock();
  input.requestLock();
});

hud.onBuyStart(() => {
  if (rounds.state.phase !== 'buy') return;
  beginRound();
  input.requestLock();
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    sound.unlock();
    hud.hideOverlay();
    hud.hideBuy();
  } else if (rounds.state.phase === 'play') {
    hud.showOverlay('paused');
  }
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function step(dt) {
  elapsed += dt;
  if (tracerLife > 0) {
    tracerLife -= dt;
    if (tracerLife <= 0) tracer.visible = false;
  }
  if (rounds.state.phase === 'play') {
    player.step(dt, input.state.keys);
    weapons.step(dt, player.groundSpeed(), !player.state.onGround);
    enemies.step(dt, body, {
      damagePlayer: (amount) => damagePlayer(amount),
      enemyShot: () => sound.enemyShot(),
      bombPlanted: () => bomb.state.planted,
      bombPosition: () => bomb.position(),
      bombDefused: () => {
        bomb.defuse();
        finishRound(false, 'The bomb was defused.');
      },
    });
    grenades.step(dt);
    // plant: hold E inside the active site
    if (input.state.keys.has('KeyE') && !bomb.state.planted) {
      const progress = bomb.plantTick(dt, body.position, true);
      hud.showPlant(progress);
      if (bomb.state.planted) {
        hud.hidePlant();
        hud.centerMessage('BOMB PLANTED — DEFEND IT');
        sound.plant();
      }
    } else {
      bomb.plantTick(dt, body.position, false);
      hud.hidePlant();
    }
    bomb.step(dt, () => finishRound(true, 'The bomb detonated. Site secured.'), () => sound.beep());
    if (rounds.step(dt) && !bomb.state.planted) {
      finishRound(false, 'Time ran out before the plant.');
    }
    // crosshair opens up with spread: still is tight, moving is wide
    hud.setCrosshairGap(4 + weapons.spread(player.groundSpeed()) * 260);
  } else {
    weapons.step(dt, 0, false);
    grenades.step(dt);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    const firing = input.state.firing;
    const def = weapons.def();
    if (firing && weapons.ready()) {
      if (def.auto || !wasFiring) shoot(shot ? 0 : weapons.spread(player.groundSpeed()));
    }
    wasFiring = firing;
    for (const code of input.takePressed()) {
      if (code === 'KeyR') {
        weapons.reload();
        sound.reload();
      } else if (code === 'Digit1') {
        if (weapons.select('primary')) refreshHud();
      } else if (code === 'Digit2') {
        if (weapons.select('pistol')) refreshHud();
      } else if (code === 'KeyG') {
        if (rounds.state.phase === 'play' && rounds.state.grenades > 0) {
          camera.getWorldDirection(direction);
          if (grenades.throwGrenade(camera.position, direction)) {
            rounds.state.grenades -= 1;
            refreshHud();
          }
        }
      } else if (code === 'KeyB' && rounds.state.phase === 'buy') {
        hud.showBuy(BUY_ITEMS, () => rounds.state.money, buyHandler);
      }
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    refreshHud();
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlay();
  hud.hideBuy();
  body.pitch = 0;
  body.yaw = 0;
  if (name === 'start') {
    player.reset(PLAYER_SPAWN.x, PLAYER_SPAWN.z, 0);
    enemies.reset(ENEMY_SPAWNS);
    bomb.reset('A');
    rounds.reset();
    weapons.reset();
    refreshHud();
    settle(20);
    aimAt(new THREE.Vector3(0, 1.5, -10));
    hud.showOverlay('start');
  } else if (name === 'play') {
    rounds.reset();
    rounds.state.money = 800;
    weapons.reset();
    weapons.buyPrimary('rifle');
    rounds.state.grenades = 1;
    rounds.state.phase = 'play';
    rounds.state.timer = 83;
    player.reset(0, 8, 0);
    enemies.reset(ENEMY_SPAWNS);
    bomb.reset('A');
    // stage the fight: the mid defender engages, a second one peeks from the west
    // (both in the open, clear of the market stalls, so the staged shots land)
    const mid = enemies.items[2];
    mid.body.position.set(3, 0, -4);
    mid.state = 'engage';
    mid.los = true;
    mid.reactionLeft = 99;
    mid.shootTimer = 99;
    const west = enemies.items[3];
    west.body.position.set(-6, 0, -2);
    west.state = 'engage';
    west.los = true;
    west.reactionLeft = 99;
    west.shootTimer = 99;
    settle(20);
    refreshHud();
    for (let round = 0; round < 3; round += 1) {
      // re-aim at the defender's chest each time: it strafes while engaging,
      // so a fixed aim point would miss after the first settle
      aimAt(new THREE.Vector3(mid.body.position.x, mid.body.position.y + 1.05, mid.body.position.z));
      shoot(0);
      if (round < 2) settle(8);
    }
    // let the kill fall: the dead defender lies down over ~0.45 s, so settle
    // long enough that the play shot shows a body on the ground, not a
    // standing one (the other defender keeps strafing but cannot shoot yet)
    settle(30);
    refreshHud();
  } else if (name === 'end') {
    rounds.reset();
    weapons.reset();
    weapons.buyPrimary('rifle');
    rounds.state.phase = 'play';
    player.reset(-14, -10, 0);
    enemies.reset(ENEMY_SPAWNS);
    bomb.reset('A');
    settle(10);
    // clear every defender, then the round ends in a win
    for (const enemy of enemies.items) {
      const point = new THREE.Vector3(enemy.body.position.x, enemy.body.position.y + 1.05, enemy.body.position.z);
      for (let round = 0; round < 3; round += 1) {
        aimAt(point);
        shoot(0);
        settle(2);
      }
    }
    settle(30);
    aimAt(new THREE.Vector3(-20, 1, -16));
    hud.showOverlay('won', { reason: 'All defenders eliminated.', earned: 3250 });
    refreshHud();
  } else if (name === 'tactics') {
    rounds.reset();
    rounds.state.round = 2;
    rounds.state.wins = 1;
    rounds.state.money = 2300;
    rounds.state.phase = 'buy';
    weapons.reset();
    player.reset(PLAYER_SPAWN.x, PLAYER_SPAWN.z, 0);
    enemies.reset(ENEMY_SPAWNS);
    bomb.reset('B');
    refreshHud();
    settle(20);
    aimAt(new THREE.Vector3(0, 1.5, -10));
    hud.showBuy(BUY_ITEMS, () => rounds.state.money, buyHandler);
  }
  refreshHud();
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
refreshHud();
if (shot) runShot(shot);
else {
  hud.showOverlay('start');
  requestAnimationFrame(frame);
}
