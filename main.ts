// SANDLINE, a threejs-fps-01 entry (Node 22, standard library only). The game
// is this directory's game/ folder — plain static files the browser loads as
// ES modules with three.js from an import map — and this program hands it in:
// it copies game/ from beside this file to /output, decodes the screenshots
// (stored in screenshots/ as base64 text, one *.jpg.b64 per image, because the
// push path only carries text) into real JPEGs under /output/screenshots, and
// writes /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. Serve it locally with `node serve.ts`, then open
// http://localhost:8080. Outside the grader's container, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
for (const name of readdirSync(join(here, 'screenshots')).sort()) {
  if (!name.endsWith('.jpg.b64')) continue;
  const jpg = name.slice(0, -'.b64'.length);
  writeFileSync(
    join(out, 'screenshots', jpg),
    Buffer.from(readFileSync(join(here, 'screenshots', name), 'utf8').trim(), 'base64'),
  );
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 }),
);
