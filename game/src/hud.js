// The DOM HUD: crosshair, health, ammo, timer, score, money, objective, the
// kill feed, the plant bar and the three overlays (menu, buy, round end). It
// never touches the simulation; main.js pushes numbers in and reads the
// callbacks out. Every setter skips a write when the value did not change.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const title = $('overlay-title');
  const copy = $('overlay-copy');
  const play = $('play');
  const buyOverlay = $('buy-overlay');
  const buyMoney = $('buy-money');
  const buyItems = $('buy-items');
  const buyStart = $('buy-start');
  const buyMsg = $('buy-msg');
  const crosshair = $('crosshair');
  const hitmarker = $('hitmarker');
  const damage = $('damage');
  const healthFill = $('health-fill');
  const healthNum = $('health-num');
  const armorFill = $('armor-fill');
  const armorNum = $('armor-num');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const weaponName = $('weapon-name');
  const grenadeCount = $('grenade-count');
  const timer = $('timer');
  const roundLabel = $('round-label');
  const scoreLabel = $('score-label');
  const moneyLabel = $('money');
  const objective = $('objective');
  const feed = $('feed');
  const plantWrap = $('plant-wrap');
  const plantFill = $('plant-fill');
  const centerMsg = $('center-msg');

  const COPY = {
    start: {
      title: 'SANDLINE',
      copy: 'A desert compound, five defenders, one bomb. Plant it at the marked site — or clear them all. Click to play.',
      action: 'Click to play',
    },
    paused: {
      title: 'SANDLINE',
      copy: 'Paused. Click to resume.',
      action: 'Click to resume',
    },
    won: {
      title: 'ROUND WON',
      copy: '',
      action: 'Continue',
    },
    lost: {
      title: 'ROUND LOST',
      copy: '',
      action: 'Continue',
    },
  };

  let lastHealth = -1;
  let lastArmor = -1;
  let lastMag = -1;
  let lastReserve = -1;
  let lastWeapon = '';
  let lastGrenades = -1;
  let lastTimer = -1;
  let lastRound = '';
  let lastScore = '';
  let lastMoney = -1;
  let lastObjective = '';
  let hitTimer = 0;
  let centerTimer = 0;
  let damageTimer = 0;

  function formatTime(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  return {
    setHealth(health, armor) {
      const hp = Math.max(0, Math.round(health));
      if (hp !== lastHealth) {
        lastHealth = hp;
        healthFill.style.width = `${hp}%`;
        healthNum.textContent = String(hp);
        healthFill.classList.toggle('low', hp <= 30);
      }
      const ar = Math.max(0, Math.round(armor));
      if (ar !== lastArmor) {
        lastArmor = ar;
        armorFill.style.width = `${ar * 2}%`;
        armorNum.textContent = String(ar);
      }
    },
    setAmmo(mag, reserve, weapon) {
      if (mag !== lastMag || reserve !== lastReserve) {
        lastMag = mag;
        lastReserve = reserve;
        ammoMag.textContent = String(mag);
        ammoReserve.textContent = `/ ${reserve}`;
        ammoMag.parentElement.classList.toggle('empty', mag === 0);
      }
      if (weapon !== lastWeapon) {
        lastWeapon = weapon;
        weaponName.textContent = weapon;
      }
    },
    setGrenades(count) {
      if (count !== lastGrenades) {
        lastGrenades = count;
        grenadeCount.textContent = `Grenades ${count}`;
      }
    },
    setTimer(seconds) {
      const text = formatTime(seconds);
      if (text !== lastTimer) {
        lastTimer = text;
        timer.textContent = text;
        timer.classList.toggle('low', seconds <= 15);
      }
    },
    setRound(round, wins, losses) {
      const text = `ROUND ${round}`;
      if (text !== lastRound) {
        lastRound = text;
        roundLabel.textContent = text;
      }
      const score = `${wins} — ${losses}`;
      if (score !== lastScore) {
        lastScore = score;
        scoreLabel.textContent = score;
      }
    },
    setMoney(value) {
      if (value !== lastMoney) {
        lastMoney = value;
        moneyLabel.textContent = `$${value}`;
      }
    },
    setObjective(text) {
      if (text !== lastObjective) {
        lastObjective = text;
        objective.textContent = text;
      }
    },
    setCrosshairGap(pixels) {
      crosshair.style.setProperty('--gap', `${pixels.toFixed(1)}px`);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.classList.toggle('kill', killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    damageFlash() {
      damage.classList.add('on');
      clearTimeout(damageTimer);
      damageTimer = setTimeout(() => damage.classList.remove('on'), 180);
    },
    feed(text) {
      const line = document.createElement('div');
      line.textContent = text;
      feed.prepend(line);
      while (feed.children.length > 4) feed.removeChild(feed.lastChild);
      setTimeout(() => line.remove(), 5000);
    },
    showPlant(progress) {
      plantWrap.hidden = false;
      plantFill.style.width = `${Math.round(progress * 100)}%`;
    },
    hidePlant() {
      plantWrap.hidden = true;
    },
    centerMessage(text, ms = 2200) {
      centerMsg.textContent = text;
      centerMsg.classList.add('on');
      clearTimeout(centerTimer);
      centerTimer = setTimeout(() => centerMsg.classList.remove('on'), ms);
    },
    showOverlay(mode, data) {
      const text = COPY[mode];
      title.textContent = text.title;
      if (mode === 'won' || mode === 'lost') {
        copy.textContent = `${data.reason} You earned $${data.earned}.`;
      } else {
        copy.textContent = text.copy;
      }
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    showBuy(items, getMoney, onBuy) {
      buyMoney.textContent = `$${getMoney()}`;
      buyMsg.textContent = '';
      buyItems.innerHTML = '';
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'buy-item';
        button.disabled = getMoney() < item.price;
        button.innerHTML = `<b>${item.name}</b><span>${item.desc}</span><i>$${item.price}</i>`;
        button.addEventListener('click', () => {
          const message = onBuy(item.id);
          if (message) {
            buyMsg.textContent = message;
            this.showBuy(items, getMoney, onBuy);
          }
        });
        buyItems.appendChild(button);
      }
      buyOverlay.hidden = false;
    },
    hideBuy() {
      buyOverlay.hidden = true;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
    onBuyStart(handler) {
      buyStart.addEventListener('click', handler);
    },
  };
}
