// SANDLINE — the look plan, in one place. A desert compound at golden hour:
// pale sky, warm sand, terracotta plaster, dark wood and one hot orange accent.
// Every colour in the game is one of these names; the CSS in index.html uses the
// same names as custom properties, so the page and the 3D scene agree.
export const PALETTE = {
  sky: '#cfe3ee',
  sand: '#c9a06a',
  plaster: '#d8c49a',
  terra: '#b5673c',
  wood: '#7a5230',
  metal: '#5a6068',
  ink: '#2b2118',
  muted: '#8a7a63',
  accent: '#e8833a',
  teal: '#2e8b8b',
  enemy: '#a83a34', // defenders: a clear red against sand and plaster
  paper: '#f2ead8',
};

export function hex(name) {
  return PALETTE[name];
}
