// Procedural canvas textures: sand, plaster, wood and metal, drawn once at boot
// from a seeded generator so every run paints the same walls. No image files, no
// network — the game stays flat-colour-free without shipping any assets.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

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

function canvas(size) {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = size;
  return [element, element.getContext('2d')];
}

function speckle(ctx, size, random, count, colors, radiusMin, radiusMax) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    ctx.globalAlpha = 0.12 + random() * 0.25;
    const r = radiusMin + random() * (radiusMax - radiusMin);
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function toTexture(element, repeatX, repeatY) {
  const texture = new THREE.CanvasTexture(element);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function sandTexture(random) {
  const size = 256;
  const [element, ctx] = canvas(size);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, random, 2600, ['#b98d55', '#d9b47e', '#a67c48', '#e0c08a'], 0.5, 2.2);
  // faint wind ripples
  ctx.strokeStyle = '#b98d55';
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 26; i += 1) {
    const y = random() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (random() * 8 - 4), size * 0.7, y + (random() * 8 - 4), size, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(element, 8, 8);
}

function plasterTexture(random) {
  const size = 256;
  const [element, ctx] = canvas(size);
  ctx.fillStyle = PALETTE.plaster;
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, random, 1400, ['#c8b184', '#e2d2ac', '#bfa87c'], 0.5, 1.8);
  // sun-baked vertical streaks
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 22; i += 1) {
    ctx.fillStyle = random() > 0.5 ? '#bfa87c' : '#e8dcc0';
    const x = random() * size;
    ctx.fillRect(x, 0, 2 + random() * 5, size);
  }
  ctx.globalAlpha = 1;
  // a terracotta dado band along the bottom
  ctx.fillStyle = PALETTE.terra;
  ctx.fillRect(0, size - 26, size, 26);
  ctx.fillStyle = 'rgba(43,33,24,0.35)';
  ctx.fillRect(0, size - 28, size, 2);
  return toTexture(element, 2, 1);
}

function woodTexture(random) {
  const size = 256;
  const [element, ctx] = canvas(size);
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(0, 0, size, size);
  const plank = size / 4;
  for (let p = 0; p < 4; p += 1) {
    const shade = 0.85 + random() * 0.3;
    ctx.fillStyle = `rgba(0,0,0,${(1 - shade) * 0.5})`;
    ctx.fillRect(0, p * plank, size, plank);
    ctx.fillStyle = `rgba(255,235,200,${(shade - 0.85) * 0.4})`;
    ctx.fillRect(0, p * plank, size, plank);
    // grain lines
    ctx.strokeStyle = 'rgba(43,33,24,0.35)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 5; g += 1) {
      const y = p * plank + 6 + random() * (plank - 12);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + (random() * 4 - 2), size * 0.7, y + (random() * 4 - 2), size, y);
      ctx.stroke();
    }
    // plank gap + nails
    ctx.fillStyle = 'rgba(43,33,24,0.55)';
    ctx.fillRect(0, p * plank, size, 2);
    ctx.fillStyle = 'rgba(20,16,12,0.6)';
    ctx.beginPath();
    ctx.arc(10, p * plank + plank / 2, 2.5, 0, Math.PI * 2);
    ctx.arc(size - 10, p * plank + plank / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // frame border
  ctx.strokeStyle = 'rgba(43,33,24,0.6)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, size - 6, size - 6);
  return toTexture(element, 1, 1);
}

function metalTexture(random) {
  const size = 256;
  const [element, ctx] = canvas(size);
  ctx.fillStyle = PALETTE.metal;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 60; i += 1) {
    ctx.strokeStyle = random() > 0.5 ? '#7d838c' : '#3f444a';
    ctx.lineWidth = 1 + random() * 2;
    const y = random() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (random() * 6 - 3));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  speckle(ctx, size, random, 90, ['#8a5a30', '#6e4526'], 1, 4);
  return toTexture(element, 1, 1);
}

export function createTextures(seed) {
  const random = mulberry32(seed);
  return {
    sand: sandTexture(random),
    plaster: plasterTexture(random),
    wood: woodTexture(random),
    metal: metalTexture(random),
  };
}
