// Rounds and money, Counter-Strike style. A round is won by clearing the
// defenders or by the bomb going off, and lost when the player dies, the clock
// runs out, or the bomb is defused. Money earned each round buys weapons,
// grenades and armour in the buy menu between rounds.
import { WEAPONS } from './weapons.js';

export const ROUND_TIME = 100;
export const KILL_REWARD = 300;
export const WIN_REWARD = 3250;
export const LOSS_REWARD = 1400;
export const START_MONEY = 800;
export const GRENADE_PRICE = 300;
export const ARMOR_PRICE = 650;
export const MAX_GRENADES = 2;

export const BUY_ITEMS = [
  { id: 'rifle', name: 'VK-7 Rifle', desc: 'Automatic rifle, 30 rounds. Accurate when still.', price: WEAPONS.rifle.price, kind: 'weapon' },
  { id: 'smg', name: 'Scorpion SMG', desc: 'Fast automatic, 25 rounds. Close quarters.', price: WEAPONS.smg.price, kind: 'weapon' },
  { id: 'grenade', name: 'Frag Grenade', desc: 'Area damage on a 2.2 s fuse. Throw with G.', price: GRENADE_PRICE, kind: 'grenade' },
  { id: 'armor', name: 'Combat Armour', desc: '+50 armour. Absorbs damage before health.', price: ARMOR_PRICE, kind: 'armor' },
];

export function createRounds() {
  const state = {
    phase: 'buy', // 'buy' | 'play' | 'end'
    round: 1,
    wins: 0,
    losses: 0,
    money: START_MONEY,
    timer: ROUND_TIME,
    lastResult: null, // { won, reason, earned }
    grenades: 0,
    armor: 0,
  };

  function siteForRound(round) {
    return round % 2 === 1 ? 'A' : 'B';
  }

  return {
    state,
    siteForRound,
    startRound() {
      state.phase = 'play';
      state.timer = ROUND_TIME;
      state.lastResult = null;
      return siteForRound(state.round);
    },
    endRound(won, reason) {
      if (state.phase !== 'play') return null;
      state.phase = 'end';
      const earned = won ? WIN_REWARD : LOSS_REWARD;
      state.money += earned;
      if (won) state.wins += 1;
      else state.losses += 1;
      state.lastResult = { won, reason, earned };
      return state.lastResult;
    },
    nextRound() {
      state.round += 1;
      state.phase = 'buy';
    },
    addKillReward() {
      state.money += KILL_REWARD;
    },
    step(dt) {
      if (state.phase !== 'play') return false;
      state.timer -= dt;
      return state.timer <= 0;
    },
    // buy one item; returns a message for the HUD, or null when it cannot be bought
    buy(id, weapons) {
      const item = BUY_ITEMS.find((entry) => entry.id === id);
      if (!item) return null;
      if (state.money < item.price) return 'Not enough money.';
      if (item.kind === 'weapon' && weapons.state.primary === id) return 'Already owned.';
      if (item.kind === 'grenade' && state.grenades >= MAX_GRENADES) return 'Already carrying two.';
      if (item.kind === 'armor' && state.armor >= 50) return 'Armour already full.';
      state.money -= item.price;
      if (item.kind === 'weapon') weapons.buyPrimary(id);
      else if (item.kind === 'grenade') state.grenades += 1;
      else if (item.kind === 'armor') state.armor = 50;
      return `Bought ${item.name}.`;
    },
    reset() {
      state.phase = 'buy';
      state.round = 1;
      state.wins = 0;
      state.losses = 0;
      state.money = START_MONEY;
      state.timer = ROUND_TIME;
      state.lastResult = null;
      state.grenades = 0;
      state.armor = 0;
    },
  };
}
