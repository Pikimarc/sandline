// Enemy bots: five defenders that patrol the compound, hold the bombsites,
// hear gunfire, and shoot back. Each bot runs a small state machine — patrol,
// alert, engage, hold, defuse — and steers with the same collision resolver
// the player uses, so a bot never walks through a wall.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { makeBody, moveBody } from './player.js';

const HEALTH = 100;
const WALK_SPEED = 2.7;
const ENGAGE_SPEED = 2.1;
const EYE_HEIGHT = 1.55;
const REACTION = 0.55;
const SHOT_GAP_MIN = 1.0;
const SHOT_GAP_MAX = 1.45;
const SHOT_DAMAGE = 10;
const HEAR_RADIUS = 26;
const LOS_PERIOD = 0.25;
const DEFUSE_TIME = 5;

const _dir = new THREE.Vector3();
const _toPlayer = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _target = new THREE.Vector3();

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

export function createEnemies(scene, colliders, shootables, spawns, patrols, seed) {
  const random = mulberry32(seed);
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;

  const uniform = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.enemy), roughness: 0.7, metalness: 0.05 });
  // the vest is the same crimson as the uniform: from the front the torso is
  // the biggest thing you see, and it must read as "enemy", not as sand
  const vest = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.enemy), roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.6, metalness: 0.3 });
  const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a06a'), roughness: 0.7 });

  const legGeometry = new THREE.BoxGeometry(0.17, 0.55, 0.17);
  const torsoGeometry = new THREE.BoxGeometry(0.54, 0.66, 0.32);
  const vestGeometry = new THREE.BoxGeometry(0.58, 0.42, 0.36);
  const headGeometry = new THREE.SphereGeometry(0.165, 14, 10);
  const helmetGeometry = new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const gunGeometry = new THREE.BoxGeometry(0.07, 0.1, 0.55);
  const armGeometry = new THREE.BoxGeometry(0.11, 0.11, 0.42);

  // a small pool of tracer lines, reused round-robin so firing allocates nothing
  const tracers = [];
  for (let i = 0; i < 8; i += 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9 }));
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerIndex = 0;

  function fireTracer(from, to) {
    const tracer = tracers[tracerIndex];
    tracerIndex = (tracerIndex + 1) % tracers.length;
    const positions = tracer.line.geometry.attributes.position;
    positions.setXYZ(0, from.x, from.y, from.z);
    positions.setXYZ(1, to.x, to.y, to.z);
    positions.needsUpdate = true;
    tracer.line.visible = true;
    tracer.life = 0.09;
  }

  function buildModel() {
    const group = new THREE.Group();
    const legL = new THREE.Mesh(legGeometry, dark);
    legL.position.set(-0.13, 0.28, 0);
    const legR = new THREE.Mesh(legGeometry, dark);
    legR.position.set(0.13, 0.28, 0);
    const torso = new THREE.Mesh(torsoGeometry, uniform);
    torso.position.set(0, 0.9, 0);
    const vestMesh = new THREE.Mesh(vestGeometry, vest);
    vestMesh.position.set(0, 0.95, 0);
    const head = new THREE.Mesh(headGeometry, skin);
    head.position.set(0, 1.42, 0);
    const helmet = new THREE.Mesh(helmetGeometry, dark);
    helmet.position.set(0, 1.46, 0);
    const gun = new THREE.Mesh(gunGeometry, dark);
    gun.position.set(0.16, 1.05, -0.28);
    const armL = new THREE.Mesh(armGeometry, uniform);
    armL.position.set(-0.14, 1.0, -0.2);
    armL.rotation.x = -0.5;
    const armR = new THREE.Mesh(armGeometry, uniform);
    armR.position.set(0.16, 1.02, -0.18);
    armR.rotation.x = -0.5;
    group.add(legL, legR, torso, vestMesh, head, helmet, gun, armL, armR);
    group.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return { group, torso, head, legL };
  }

  const items = [];
  const hitMeshes = [];

  for (let i = 0; i < spawns.length; i += 1) {
    const spawn = spawns[i];
    const model = buildModel();
    model.group.position.copy(spawn);
    scene.add(model.group);
    const body = makeBody(spawn.x, spawn.z, Math.PI);
    const item = {
      index: i,
      group: model.group,
      torso: model.torso,
      head: model.head,
      leg: model.legL,
      body,
      health: HEALTH,
      alive: true,
      state: 'patrol',
      patrol: patrols[i],
      waypoint: 0,
      waitLeft: 0,
      holdPoint: spawn.clone(),
      lastKnown: new THREE.Vector3(),
      alertLeft: 0,
      los: false,
      losTimer: i * 0.05,
      reactionLeft: 0,
      shootTimer: 0,
      strafeDir: 1,
      strafeTimer: 0,
      scanAngle: 0,
      fall: 0,
      defuseProgress: 0,
    };
    model.torso.userData.enemy = item;
    model.torso.userData.part = 'torso';
    model.head.userData.enemy = item;
    model.head.userData.part = 'head';
    model.legL.userData.enemy = item;
    model.legL.userData.part = 'torso';
    hitMeshes.push(model.torso, model.head, model.legL);
    items.push(item);
  }

  function hasLineOfSight(item, playerPos) {
    _eye.set(item.body.position.x, item.body.position.y + EYE_HEIGHT, item.body.position.z);
    _toPlayer.set(playerPos.x, playerPos.y + 1.25, playerPos.z);
    const distance = _eye.distanceTo(_toPlayer);
    _dir.copy(_toPlayer).sub(_eye).normalize();
    raycaster.set(_eye, _dir);
    raycaster.far = distance;
    const hit = raycaster.intersectObjects(shootables, false)[0];
    return !hit || hit.distance >= distance - 0.4;
  }

  function faceToward(item, x, z) {
    const dx = x - item.body.position.x;
    const dz = z - item.body.position.z;
    if (dx * dx + dz * dz < 0.0001) return;
    item.body.yaw = Math.atan2(-dx, -dz);
  }

  function steer(item, x, z, speed, dt) {
    _dir.set(x - item.body.position.x, 0, z - item.body.position.z);
    const length = _dir.length();
    if (length < 0.25) {
      item.body.velocity.x = 0;
      item.body.velocity.z = 0;
      moveBody(colliders, item.body, dt);
      return true;
    }
    _dir.multiplyScalar(1 / length);
    item.body.velocity.x = _dir.x * speed;
    item.body.velocity.z = _dir.z * speed;
    faceToward(item, x, z);
    moveBody(colliders, item.body, dt);
    return false;
  }

  function damage(item, amount, playerPos) {
    if (!item.alive) return false;
    item.health -= amount;
    item.defuseProgress = 0;
    if (playerPos) {
      item.lastKnown.copy(playerPos);
      if (item.state !== 'engage') {
        item.state = 'alert';
        item.alertLeft = 3;
      }
    }
    if (item.health > 0) return false;
    item.alive = false;
    item.state = 'dead';
    item.fall = 0;
    item.body.velocity.set(0, 0, 0);
    return true;
  }

  function hearShot(position) {
    for (const item of items) {
      if (!item.alive || item.state === 'engage') continue;
      if (item.body.position.distanceTo(position) <= HEAR_RADIUS) {
        item.lastKnown.copy(position);
        item.state = 'alert';
        item.alertLeft = 4;
      }
    }
  }

  function step(dt, player, hooks) {
    for (const tracer of tracers) {
      if (tracer.life > 0) {
        tracer.life -= dt;
        if (tracer.life <= 0) tracer.line.visible = false;
      }
    }
    const playerPos = player.position;
    const playerSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    for (const item of items) {
      if (!item.alive) {
        if (item.fall < 1) {
          item.fall = Math.min(1, item.fall + dt / 0.45);
          item.group.rotation.x = -item.fall * 1.5;
          item.group.position.y = -item.fall * 0.1;
        }
        continue;
      }
      // staggered line-of-sight checks, so the raycaster never runs five times a frame
      item.losTimer -= dt;
      if (item.losTimer <= 0) {
        item.losTimer = LOS_PERIOD;
        item.los = hasLineOfSight(item, playerPos);
        if (item.los && item.state !== 'engage') {
          item.state = 'engage';
          item.reactionLeft = REACTION;
          item.shootTimer = REACTION + 0.2 + random() * 0.3;
        } else if (!item.los && item.state === 'engage') {
          item.state = 'alert';
          item.alertLeft = 3;
          item.lastKnown.copy(playerPos);
        }
      }

      if (item.state === 'patrol') {
        const waypoint = item.patrol[item.waypoint];
        if (item.waitLeft > 0) {
          item.waitLeft -= dt;
          item.scanAngle += dt * 0.7;
          item.body.yaw += dt * 0.7;
        } else if (steer(item, waypoint[0], waypoint[1], WALK_SPEED, dt)) {
          item.waypoint = (item.waypoint + 1) % item.patrol.length;
          item.waitLeft = 0.8 + random() * 1.2;
        }
      } else if (item.state === 'hold') {
        item.scanAngle += dt * 0.5;
        item.body.yaw += dt * 0.5;
        item.body.velocity.set(0, 0, 0);
        moveBody(colliders, item.body, dt);
      } else if (item.state === 'alert') {
        item.alertLeft -= dt;
        const arrived = steer(item, item.lastKnown.x, item.lastKnown.z, WALK_SPEED * 1.25, dt);
        if (arrived || item.alertLeft <= 0) {
          item.scanAngle += dt * 1.4;
          item.body.yaw += dt * 1.4;
          if (item.alertLeft <= 0) {
            item.state = 'patrol';
            item.waitLeft = 0;
          }
        }
      } else if (item.state === 'engage') {
        faceToward(item, playerPos.x, playerPos.z);
        // strafe sideways while firing, flipping direction every second or so
        item.strafeTimer -= dt;
        if (item.strafeTimer <= 0) {
          item.strafeTimer = 0.7 + random() * 0.7;
          item.strafeDir = random() > 0.5 ? 1 : -1;
        }
        const sin = Math.sin(item.body.yaw);
        const cos = Math.cos(item.body.yaw);
        _target.set(cos * item.strafeDir, 0, -sin * item.strafeDir);
        item.body.velocity.x = _target.x * ENGAGE_SPEED;
        item.body.velocity.z = _target.z * ENGAGE_SPEED;
        moveBody(colliders, item.body, dt);
        if (item.reactionLeft > 0) {
          item.reactionLeft -= dt;
        } else if (item.los) {
          item.shootTimer -= dt;
          if (item.shootTimer <= 0) {
            item.shootTimer = SHOT_GAP_MIN + random() * (SHOT_GAP_MAX - SHOT_GAP_MIN);
            const distance = item.body.position.distanceTo(playerPos);
            let chance = distance < 12 ? 0.42 : distance < 22 ? 0.32 : 0.22;
            if (playerSpeed > 3) chance -= 0.12;
            if (player.crouching) chance -= 0.08;
            _eye.set(item.body.position.x, item.body.position.y + 1.35, item.body.position.z);
            _target.set(playerPos.x, playerPos.y + 1.25, playerPos.z);
            if (random() < chance) {
              fireTracer(_eye, _target);
              hooks.damagePlayer(SHOT_DAMAGE, item.body.position);
            } else {
              _target.x += (random() * 2 - 1) * 1.2;
              _target.y += (random() * 2 - 1) * 0.8;
              fireTracer(_eye, _target);
            }
            hooks.enemyShot(item.body.position);
          }
        }
      } else if (item.state === 'defuse') {
        // channel the defuse at the bomb; any damage resets it (see damage())
        const bombPos = hooks.bombPosition();
        if (!bombPos) {
          item.state = 'alert';
          item.alertLeft = 2;
          continue;
        }
        const arrived = steer(item, bombPos.x, bombPos.z, WALK_SPEED * 1.3, dt);
        if (arrived) {
          faceToward(item, bombPos.x, bombPos.z);
          item.defuseProgress += dt;
          item.body.velocity.set(0, 0, 0);
          moveBody(colliders, item.body, dt);
          if (item.defuseProgress >= DEFUSE_TIME) {
            item.defuseProgress = 0;
            hooks.bombDefused();
          }
        }
      }

      // bomb planted: every living bot converges on it instead of patrolling
      if (hooks.bombPlanted() && item.alive && item.state !== 'engage' && item.state !== 'defuse') {
        const bombPos = hooks.bombPosition();
        if (bombPos) {
          const distance = item.body.position.distanceTo(bombPos);
          if (distance < 2.2) item.state = 'defuse';
          else if (item.state === 'patrol' || item.state === 'hold') {
            item.state = 'alert';
            item.alertLeft = 30;
            item.lastKnown.copy(bombPos);
          }
        }
      }

      item.group.position.set(item.body.position.x, item.body.position.y, item.body.position.z);
      item.group.rotation.y = item.body.yaw + Math.PI;
    }
  }

  function reset(spawns) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const spawn = spawns[i];
      item.body.position.set(spawn.x, 0, spawn.z);
      item.body.velocity.set(0, 0, 0);
      item.body.yaw = Math.PI;
      item.health = HEALTH;
      item.alive = true;
      item.state = i < 2 ? 'hold' : 'patrol';
      item.holdPoint.copy(spawn);
      item.waypoint = 0;
      item.waitLeft = 0;
      item.alertLeft = 0;
      item.los = false;
      item.reactionLeft = 0;
      item.shootTimer = 0;
      item.fall = 0;
      item.defuseProgress = 0;
      item.group.rotation.set(0, item.body.yaw + Math.PI, 0);
      item.group.position.copy(item.body.position);
    }
    for (const tracer of tracers) {
      tracer.line.visible = false;
      tracer.life = 0;
    }
  }

  return {
    items,
    hitMeshes,
    damage,
    hearShot,
    step,
    reset,
    remaining() {
      let count = 0;
      for (const item of items) if (item.alive) count += 1;
      return count;
    },
  };
}
