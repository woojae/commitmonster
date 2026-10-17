/* Commit Muncher — the monster loose in a maze made of code, played inside
   the editor as muncher.game. Every pellet is a glyph, the power pellets are
   cookies, and the four things chasing him are bugs. Eat a cookie and the
   bugs become fixable. Everything is drawn on a canvas; nothing is fetched.

   Talks to the workbench only through window.CommitMuncher (key, setVisible,
   start, pause) and 'commitmuncher' CustomEvents on document. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('mz-screen');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const container = $('editor-game');
  const overlay = $('mz-overlay');
  const overlayTitle = $('mz-overlay-title');
  const overlayMsg = $('mz-overlay-msg');
  const startBtn = $('mz-start');
  const toggleBtn = $('mz-toggle');
  const scoreEl = $('mz-score');
  const bestEl = $('mz-best');
  const levelEl = $('mz-level');
  const bugsEl = $('mz-bugs');
  const soundCheck = $('cm-sound');

  const STORAGE_KEY = 'commitmonster.muncher.best';

  let visible = false;

  const api = { onEvent: null };
  window.CommitMuncher = api;

  function emit(type, data) {
    try {
      document.dispatchEvent(new CustomEvent('commitmuncher', { detail: { type, data } }));
    } catch (e) { /* ancient browser */ }
  }

  function soundOn() {
    return !soundCheck || soundCheck.checked;
  }

  // ---- Maze ---------------------------------------------------------------
  // # wall · . glyph · o cookie · - bug house door · space: corridor (or void,
  // if it cannot be reached from the start tile).

  const MAP = [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.####.#####.##.#####.####.#',
    '#..........................#',
    '#.####.##.########.##.####.#',
    '#.####.##.########.##.####.#',
    '#......##....##....##......#',
    '######.##### ## #####.######',
    '     #.##### ## #####.#     ',
    '     #.##          ##.#     ',
    '     #.## ###--### ##.#     ',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '     #.## ######## ##.#     ',
    '     #.##          ##.#     ',
    '     #.## ######## ##.#     ',
    '######.## ######## ##.######',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o..##.......  .......##..o#',
    '###.##.##.########.##.##.###',
    '###.##.##.########.##.##.###',
    '#......##....##....##......#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################',
  ];

  const COLS = 28;
  const ROWS = 31;
  const T = 20;                 // tile size in logical pixels
  const BAR_H = 36;             // editor status bar under the maze
  const W = COLS * T;
  const H = ROWS * T + BAR_H;
  const TUNNEL_ROW = 14;
  const PLAYER_START = { x: 13, y: 23 };
  const HOUSE_EXIT = { x: 13, y: 11 };
  const HOUSE_HOME = { x: 13, y: 14 };
  const BONUS_TILE = { x: 13, y: 17 };

  const DIRS = {
    up: { x: 0, y: -1 },
    left: { x: -1, y: 0 },
    down: { x: 0, y: 1 },
    right: { x: 1, y: 0 },
  };
  const DIR_ORDER = ['up', 'left', 'down', 'right'];
  const NONE = { x: 0, y: 0 };

  const COLORS = {
    text: '#cdd6f4',
    string: '#a6e3a1',
    number: '#fab387',
    keyword: '#cba6f7',
    punct: '#89b4fa',
    bg: '#1a1d27',
    barBg: '#151821',
    wallDark: '#1b3a6b',
    wall: '#2b7de9',
    door: '#f5a3c7',
    dim: '#8a8f9c',
    cookie: '#c98a3e',
  };
  const GLYPH_COLORS = [COLORS.punct, COLORS.punct, COLORS.text, COLORS.string, COLORS.number, COLORS.keyword];
  const GLYPHS = ';;;{}()[]=<>+-*/.:,!&|"\'$#@%^~?'.split('');

  const FONT_GLYPH = 'bold 12px Menlo, Monaco, "Courier New", monospace';
  const FONT_BAR = '12px Menlo, Monaco, "Courier New", monospace';
  const FONT_BUBBLE = '9px "Press Start 2P", monospace';
  const FONT_BIG = '11px "Press Start 2P", monospace';
  const FONT_POP = '8px "Press Start 2P", monospace';

  const BUGS = [
    { name: 'NullPointer', color: '#ff5f56', scatter: { x: 25, y: 0 }, release: 0 },
    { name: 'RaceCondition', color: '#f5a3c7', scatter: { x: 2, y: 0 }, release: 1 },
    { name: 'OffByOne', color: '#5fd7ff', scatter: { x: 27, y: 30 }, release: 4 },
    { name: 'MemoryLeak', color: '#ffb86c', scatter: { x: 0, y: 30 }, release: 7 },
  ];

  const SCHEDULE = [7, 20, 7, 20, 5, 20, 5, Infinity]; // scatter, chase, ...
  const BONUS_POINTS = [100, 300, 500, 700, 1000, 2000, 3000, 5000];
  const GHOST_POINTS = [200, 400, 800, 1600];

  const QUOTES = [
    'OM NOM NOM NOM', 'ME LOVE CODE', 'TASTY SEMICOLON', 'CRUNCHY BRACES',
    'NOM NOM NOM', 'MORE! MORE!', 'ME NEVER FULL', 'BUG CAN NOT CATCH ME',
    'MMM, INDENTATION', 'ME EAT WHOLE REPO', 'WHERE COOKIE?',
  ];
  const ON_COOKIE = ['COOKIE!!!', 'ME FIX BUGS NOW', 'BUGS LOOK TASTY', 'ME FEEL STRONG'];
  const ON_BUG = ['BUG FIXED', 'BUG TASTY', 'CLOSED: RESOLVED', 'WONTFIX? ME FIX', 'CRUNCHY BUG'];
  const ON_DEATH = ['SEGFAULT', 'ME NEED COFFEE', 'WORKED ON MY MACHINE', 'STACK OVERFLOW', 'OUCH. BUG BITE'];
  const ON_LEVEL = ['ME EAT WHOLE REPO', 'SHIP IT', 'ALL TESTS PASS', 'MERGE TO MAIN'];
  const ON_BONUS = ['PR MERGED!', 'LGTM', 'APPROVED'];

  // ---- Canvas setup -------------------------------------------------------

  let wallLayer = null;
  let wallFlashLayer = null;

  function fitCanvas() {
    if (!grid.length) buildGrid(); // a resize can arrive before boot
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wallLayer = buildWallLayer(COLORS.wallDark, COLORS.wall, dpr);
    wallFlashLayer = buildWallLayer('#6f7a8c', '#ffffff', dpr);
  }

  // ---- Audio --------------------------------------------------------------

  let audio = null;

  function ensureAudio() {
    if (audio) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = new AC();
    const len = audio.sampleRate * 0.12;
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    audio.crunch = buf;
  }

  function canPlay() {
    if (!audio || !soundOn()) return false;
    if (audio.state === 'suspended') audio.resume();
    return true;
  }

  function playNom(strength = 1) {
    if (!canPlay()) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = audio.crunch;
    src.playbackRate.value = 0.8 + Math.random() * 0.6;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700 + Math.random() * 600;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.22 * strength, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    const osc = audio.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    const og = audio.createGain();
    og.gain.setValueAtTime(0.08 * strength, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(filter).connect(gain).connect(audio.destination);
    osc.connect(og).connect(audio.destination);
    src.start(t);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  function blip(freqs, dur, type = 'square', vol = 0.12) {
    if (!canPlay()) return;
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    osc.type = type;
    freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, t + (i * dur) / freqs.length));
    const g = audio.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  function playCookie() { blip([330, 440, 554, 660, 880], 0.35, 'square', 0.1); }
  function playBug() { blip([880, 660, 440, 220], 0.3, 'sawtooth', 0.12); playNom(1.4); }
  function playBonus() { blip([523, 659, 784, 1047], 0.3, 'triangle', 0.14); }
  function playLife() { blip([659, 784, 1047, 1319, 1568], 0.5, 'triangle', 0.12); }

  function playDeath() {
    if (!canPlay()) return;
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 1.1);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(g).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 1.2);
  }

  function playBurp() {
    if (!canPlay()) return;
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(60, t + 0.5);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(g).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  // ---- Level geometry -----------------------------------------------------

  let grid = [];          // 0 wall/void · 1 corridor · 2 door
  let pellets = new Map(); // "x,y" -> { x, y, ch, color, power }
  let totalPellets = 0;

  function key(x, y) { return x + ',' + y; }

  function buildGrid() {
    grid = MAP.map(() => new Array(COLS).fill(0));
    const stack = [PLAYER_START];
    const seen = new Set();
    while (stack.length) {
      const p = stack.pop();
      const k = key(p.x, p.y);
      if (seen.has(k)) continue;
      seen.add(k);
      grid[p.y][p.x] = MAP[p.y][p.x] === '-' ? 2 : 1;
      for (const name of DIR_ORDER) {
        const d = DIRS[name];
        const nx = p.x + d.x;
        const ny = p.y + d.y;
        if (ny < 0 || ny >= ROWS || nx < 0 || nx >= COLS) continue;
        if (MAP[ny][nx] === '#') continue;
        stack.push({ x: nx, y: ny });
      }
    }
  }

  function buildPellets() {
    pellets = new Map();
    let i = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = MAP[y][x];
        if (c !== '.' && c !== 'o') continue;
        pellets.set(key(x, y), {
          x, y,
          power: c === 'o',
          ch: GLYPHS[(x * 7 + y * 13 + i) % GLYPHS.length],
          color: GLYPH_COLORS[(x * 3 + y * 5 + i) % GLYPH_COLORS.length],
        });
        i++;
      }
    }
    totalPellets = pellets.size;
  }

  function isOpen(x, y, canDoor) {
    if (y === TUNNEL_ROW && (x < 0 || x >= COLS)) return true;
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return false;
    const c = grid[y][x];
    if (c === 1) return true;
    if (c === 2) return !!canDoor;
    return false;
  }

  function isWall(x, y) {
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return false;
    return MAP[y][x] === '#';
  }

  // Only wall tiles that touch a corridor are drawn, then joined to their
  // drawn neighbours, so solid blocks come out as outlined shapes.
  function buildWallLayer(dark, bright, dpr) {
    const off = document.createElement('canvas');
    off.width = Math.round(W * dpr);
    off.height = Math.round(ROWS * T * dpr);
    const c = off.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const edge = [];
    for (let y = 0; y < ROWS; y++) {
      edge.push([]);
      for (let x = 0; x < COLS; x++) {
        let e = false;
        if (isWall(x, y)) {
          for (let dy = -1; dy <= 1 && !e; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (ny < 0 || ny >= ROWS || nx < 0 || nx >= COLS) continue;
              if (grid[ny][nx]) { e = true; break; }
            }
          }
        }
        edge[y].push(e);
      }
    }
    // A segment between two wall tiles is only drawn when it borders open
    // space on at least one side, so thick blocks become outlines.
    const exposedH = (x, y) => !isWall(x, y - 1) || !isWall(x + 1, y - 1) || !isWall(x, y + 1) || !isWall(x + 1, y + 1);
    const exposedV = (x, y) => !isWall(x - 1, y) || !isWall(x - 1, y + 1) || !isWall(x + 1, y) || !isWall(x + 1, y + 1);
    const passes = [[dark, 8], [bright, 3]];
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const [color, width] of passes) {
      c.strokeStyle = color;
      c.fillStyle = color;
      c.lineWidth = width;
      c.beginPath();
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (!edge[y][x]) continue;
          const cx = (x + 0.5) * T;
          const cy = (y + 0.5) * T;
          let joined = false;
          if (edge[y][x + 1] && exposedH(x, y)) { c.moveTo(cx, cy); c.lineTo(cx + T, cy); joined = true; }
          if (y + 1 < ROWS && edge[y + 1][x] && exposedV(x, y)) { c.moveTo(cx, cy); c.lineTo(cx, cy + T); joined = true; }
          if (x > 0 && edge[y][x - 1] && exposedH(x - 1, y)) joined = true;
          if (y > 0 && edge[y - 1][x] && exposedV(x, y - 1)) joined = true;
          if (!joined) { c.moveTo(cx + width / 2, cy); c.arc(cx, cy, width / 2, 0, Math.PI * 2); }
        }
      }
      c.stroke();
    }
    // the bug house door
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAP[y][x] !== '-') continue;
        c.fillStyle = COLORS.door;
        c.fillRect(x * T, (y + 0.5) * T - 2, T, 4);
      }
    }
    return off;
  }

  // ---- State --------------------------------------------------------------

  const game = {
    phase: 'ready',   // ready | intro | playing | paused | eaten | dying | clear | over
    timer: 0,
    score: 0,
    best: 0,
    level: 1,
    lives: 3,
    bugsFixed: 0,
    eaten: 0,
    combo: 0,
    extraLifeGiven: false,
    modeIdx: 0,
    modeTimer: 0,
    mode: 'scatter',
    fright: 0,
    frightTotal: 1,
    bonus: null,      // { timer, points }
    bonusesTaken: 0,
    bubble: null,
    nextQuote: 0,
    pops: [],         // floating score text
    hidePlayer: false,
    justFixed: null,
    sinceStart: 0,
    lastTs: 0,
    pausedBefore: 'ready',
  };

  const player = {
    x: 0, y: 0,
    dir: NONE,
    want: null,
    face: DIRS.left,
    mouth: 0,
    deathT: 0,
  };

  const bugs = BUGS.map((def, i) => ({
    def, index: i,
    x: 0, y: 0,
    dir: NONE,
    state: 'waiting',   // waiting | leaving | out | eyes
    mode: 'scatter',    // scatter | chase | fright
    frightened: false,
    releaseIn: 0,
    path: [],
    bob: i * 1.7,
  }));

  try {
    game.best = parseInt(localStorage.getItem(STORAGE_KEY), 10) || 0;
  } catch (e) { /* storage unavailable */ }

  function tileCenter(tx, ty) { return { x: (tx + 0.5) * T, y: (ty + 0.5) * T }; }
  function tileOf(e) { return { x: Math.floor(e.x / T), y: Math.floor(e.y / T) }; }
  function same(a, b) { return a.x === b.x && a.y === b.y; }
  function opposite(d) { return { x: -d.x, y: -d.y }; }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function levelMul() { return Math.min(1.35, 1 + (game.level - 1) * 0.06); }
  function frightDuration() { return Math.max(1.5, 6.5 - (game.level - 1) * 0.5); }

  function updateStats() {
    scoreEl.textContent = game.score;
    bestEl.textContent = game.best;
    levelEl.textContent = game.level;
    bugsEl.textContent = game.bugsFixed;
  }

  function addScore(n) {
    game.score += n;
    if (game.score > game.best) game.best = game.score;
    emit('score', game.score);
    if (!game.extraLifeGiven && game.score >= 10000) {
      game.extraLifeGiven = true;
      game.lives++;
      playLife();
      say('EXTRA LIFE. ME UNSTOPPABLE', 2000);
    }
    updateStats();
  }

  function say(text, ms = 1500) {
    game.bubble = { text, until: performance.now() + ms };
  }

  function pop(x, y, text, color = '#fff') {
    game.pops.push({ x, y, text, color, until: performance.now() + 1000 });
  }

  function resetPositions() {
    const p = tileCenter(PLAYER_START.x, PLAYER_START.y);
    player.x = p.x + T / 2; // sit between the two blank start tiles
    player.y = p.y;
    player.dir = NONE;
    player.want = DIRS.left;
    player.face = DIRS.left;
    player.deathT = 0;
    game.hidePlayer = false;

    const spots = [HOUSE_EXIT, HOUSE_HOME, { x: 11, y: 14 }, { x: 16, y: 14 }];
    bugs.forEach((g, i) => {
      const c = tileCenter(spots[i].x, spots[i].y);
      g.x = c.x;
      g.y = c.y;
      g.state = i === 0 ? 'out' : 'waiting';
      g.dir = i === 0 ? DIRS.left : NONE;
      g.mode = 'scatter';
      g.frightened = false;
      g.releaseIn = Math.max(0, g.def.release - (game.level - 1) * 0.5);
      g.path = [];
    });

    game.mode = 'scatter';
    game.modeIdx = 0;
    game.modeTimer = SCHEDULE[0];
    game.fright = 0;
    game.combo = 0;
    game.bonus = null;
    game.bubble = null;
    game.pops = [];
    game.sinceStart = 0;
  }

  function newLevel() {
    buildPellets();
    game.eaten = 0;
    game.bonusesTaken = 0;
    resetPositions();
  }

  function newGame() {
    game.score = 0;
    game.level = 1;
    game.lives = 3;
    game.bugsFixed = 0;
    game.extraLifeGiven = false;
    newLevel();
    updateStats();
  }

  function enterIntro(ms) {
    game.phase = 'intro';
    game.timer = ms;
    game.nextQuote = performance.now() + 4000;
  }

  // ---- Movement -----------------------------------------------------------

  const EPS = 0.01;

  function wrap(e) {
    if (e.x < -T / 2) e.x += COLS * T;
    else if (e.x > COLS * T + T / 2) e.x -= COLS * T;
  }

  function stopped(e) { return e.dir.x === 0 && e.dir.y === 0; }

  // Slide an entity along the grid. decide() is called whenever it sits on a
  // tile centre and may change its direction.
  function advance(e, dist, canDoor, decide) {
    let guard = 0;
    while (dist > 0 && guard++ < 64) {
      const tx = Math.floor(e.x / T);
      const ty = Math.floor(e.y / T);
      const cx = (tx + 0.5) * T;
      const cy = (ty + 0.5) * T;
      if (stopped(e)) {
        e.x = cx;
        e.y = cy;
        decide(e, tx, ty);
        if (stopped(e) || !isOpen(tx + e.dir.x, ty + e.dir.y, canDoor)) { e.dir = NONE; return; }
      }
      let ahead = e.dir.x ? (cx - e.x) * e.dir.x : (cy - e.y) * e.dir.y;
      if (ahead < -EPS) ahead += T; // past this centre, aim at the next one
      if (ahead > EPS) {
        const step = Math.min(dist, ahead);
        e.x += e.dir.x * step;
        e.y += e.dir.y * step;
        dist -= step;
        wrap(e);
        continue;
      }
      e.x = cx;
      e.y = cy;
      decide(e, tx, ty);
      if (stopped(e) || !isOpen(tx + e.dir.x, ty + e.dir.y, canDoor)) { e.dir = NONE; return; }
      const step = Math.min(dist, T);
      e.x += e.dir.x * step;
      e.y += e.dir.y * step;
      dist -= step;
      wrap(e);
    }
  }

  function playerDecide(p, tx, ty) {
    if (p.want && isOpen(tx + p.want.x, ty + p.want.y, false)) {
      p.dir = p.want;
      p.face = p.want;
    }
  }

  function setWant(d) {
    player.want = d;
    if (!stopped(player) && d.x === -player.dir.x && d.y === -player.dir.y) {
      player.dir = d;
      player.face = d;
    }
  }

  function bugTarget(g) {
    if (g.state === 'eyes') return HOUSE_HOME;
    if (g.mode === 'scatter') return g.def.scatter;
    const pt = tileOf(player);
    const f = player.face;
    switch (g.index) {
      case 0: return pt;
      case 1: return { x: pt.x + f.x * 4, y: pt.y + f.y * 4 };
      case 2: {
        const red = tileOf(bugs[0]);
        const ax = pt.x + f.x * 2;
        const ay = pt.y + f.y * 2;
        return { x: ax * 2 - red.x, y: ay * 2 - red.y };
      }
      default: {
        const me = tileOf(g);
        const dx = me.x - pt.x;
        const dy = me.y - pt.y;
        return dx * dx + dy * dy > 64 ? pt : g.def.scatter;
      }
    }
  }

  function bugDecide(g, tx, ty) {
    if (tx < 0 || tx >= COLS) return; // in the tunnel: keep going
    if (g.state === 'eyes' && tx === HOUSE_HOME.x && ty === HOUSE_HOME.y) {
      g.state = 'waiting';
      g.releaseIn = 0.4;
      g.dir = NONE;
      return;
    }
    const canDoor = g.state === 'eyes';
    const back = opposite(g.dir);
    const options = DIR_ORDER.map((n) => DIRS[n])
      .filter((d) => !same(d, back) && isOpen(tx + d.x, ty + d.y, canDoor));
    if (!options.length) { g.dir = back; return; }
    if (g.mode === 'fright' && g.state !== 'eyes') { g.dir = pick(options); return; }
    const target = bugTarget(g);
    let best = options[0];
    let bestD = Infinity;
    for (const d of options) {
      const dx = tx + d.x - target.x;
      const dy = ty + d.y - target.y;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = d; }
    }
    g.dir = best;
  }

  function bugSpeed(g) {
    if (g.state === 'eyes') return 16 * T;
    if (g.mode === 'fright') return 5 * T;
    const t = tileOf(g);
    if (t.y === TUNNEL_ROW && (t.x < 6 || t.x > 21)) return 4.2 * T;
    return 7.6 * T * levelMul();
  }

  function playerSpeed() {
    return (game.fright > 0 ? 8.8 : 8.3) * T * levelMul();
  }

  function moveAlong(g, dist) {
    while (dist > 0 && g.path.length) {
      const p = g.path[0];
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) g.dir = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      if (d <= dist) {
        g.x = p.x;
        g.y = p.y;
        dist -= d;
        g.path.shift();
      } else {
        g.x += (dx / d) * dist;
        g.y += (dy / d) * dist;
        dist = 0;
      }
    }
    return g.path.length === 0;
  }

  function reverseOut(g) {
    if (g.state === 'out' && !stopped(g)) g.dir = opposite(g.dir);
  }

  function startFright() {
    game.fright = frightDuration();
    game.frightTotal = game.fright;
    game.combo = 0;
    for (const g of bugs) {
      if (g.state === 'eyes') continue;
      g.frightened = true;
      if (g.state === 'out') {
        g.mode = 'fright';
        reverseOut(g);
      }
    }
  }

  function endFright() {
    game.fright = 0;
    for (const g of bugs) {
      g.frightened = false;
      if (g.mode === 'fright') g.mode = game.mode;
    }
  }

  function flipMode() {
    game.modeIdx = Math.min(game.modeIdx + 1, SCHEDULE.length - 1);
    game.modeTimer = SCHEDULE[game.modeIdx];
    game.mode = game.modeIdx % 2 ? 'chase' : 'scatter';
    for (const g of bugs) {
      if (g.state === 'out' && g.mode !== 'fright') {
        g.mode = game.mode;
        reverseOut(g);
      }
    }
  }

  // ---- Simulation ---------------------------------------------------------

  function step(dt) {
    game.sinceStart += dt;

    // mode clocks
    if (game.fright > 0) {
      game.fright -= dt;
      if (game.fright <= 0) endFright();
    } else {
      game.modeTimer -= dt;
      if (game.modeTimer <= 0) flipMode();
    }

    // player
    advance(player, playerSpeed() * dt, false, playerDecide);
    player.mouth += dt * (stopped(player) ? 3 : 14);
    eatHere();

    // bugs
    for (const g of bugs) {
      if (g.state === 'waiting') {
        g.releaseIn -= dt;
        g.bob += dt * 4;
        if (g.releaseIn <= 0) {
          g.state = 'leaving';
          const home = tileCenter(HOUSE_HOME.x, HOUSE_HOME.y);
          const exit = tileCenter(HOUSE_EXIT.x, HOUSE_EXIT.y);
          g.path = [{ x: home.x, y: g.y }, home, exit];
        }
      } else if (g.state === 'leaving') {
        if (moveAlong(g, 5 * T * dt)) {
          g.state = 'out';
          g.dir = DIRS.left;
          g.mode = g.frightened && game.fright > 0 ? 'fright' : game.mode;
        }
      } else {
        advance(g, bugSpeed(g) * dt, g.state === 'eyes', bugDecide);
      }
    }

    // bonus
    if (game.bonus) {
      game.bonus.timer -= dt;
      if (game.bonus.timer <= 0) game.bonus = null;
      else {
        const pt = tileOf(player);
        if (pt.y === BONUS_TILE.y && (pt.x === BONUS_TILE.x || pt.x === BONUS_TILE.x + 1)) {
          const c = tileCenter(BONUS_TILE.x, BONUS_TILE.y);
          addScore(game.bonus.points);
          pop(c.x + T / 2, c.y, String(game.bonus.points), COLORS.keyword);
          say(pick(ON_BONUS), 1600);
          playBonus();
          game.bonus = null;
        }
      }
    }

    // collisions
    for (const g of bugs) {
      if (g.state !== 'out') continue;
      if (Math.abs(g.x - player.x) < T * 0.6 && Math.abs(g.y - player.y) < T * 0.6) {
        if (g.mode === 'fright') {
          fixBug(g);
          return;
        }
        die();
        return;
      }
    }

    // idle chatter
    const now = performance.now();
    if (now > game.nextQuote) {
      game.nextQuote = now + 5000 + Math.random() * 5000;
      if (!game.bubble || game.bubble.until < now) say(pick(QUOTES), 1400);
    }
  }

  function eatHere() {
    const pt = tileOf(player);
    const k = key(pt.x, pt.y);
    const p = pellets.get(k);
    if (!p) return;
    pellets.delete(k);
    game.eaten++;
    if (p.power) {
      addScore(50);
      startFright();
      playCookie();
      say(pick(ON_COOKIE), 1600);
    } else {
      addScore(10);
      playNom(0.6);
    }
    if ((game.eaten === 70 || game.eaten === 170) && !game.bonus) {
      game.bonus = {
        timer: 9,
        points: BONUS_POINTS[Math.min(game.level - 1, BONUS_POINTS.length - 1)],
      };
    }
    if (pellets.size === 0) {
      game.phase = 'clear';
      game.timer = 2200;
      playBurp();
      say(pick(ON_LEVEL), 2200);
    }
  }

  function fixBug(g) {
    const points = GHOST_POINTS[Math.min(game.combo, GHOST_POINTS.length - 1)];
    game.combo++;
    game.bugsFixed++;
    addScore(points);
    pop(g.x, g.y - 6, String(points), '#fff');
    say(pick(ON_BUG), 1400);
    playBug();
    emit('bug', { name: g.def.name, points });
    g.state = 'eyes';
    g.mode = game.mode;
    g.frightened = false;
    game.justFixed = g;
    game.phase = 'eaten';
    game.timer = 550;
  }

  function die() {
    game.phase = 'dying';
    game.timer = 1500;
    player.deathT = 0;
    game.bonus = null;
    say(pick(ON_DEATH), 1500);
    playDeath();
  }

  function afterDeath() {
    game.lives--;
    if (game.lives <= 0) {
      gameOver();
      return;
    }
    resetPositions();
    enterIntro(1400);
  }

  // ---- Drawing ------------------------------------------------------------

  function drawPellets(t) {
    ctx.font = FONT_GLYPH;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of pellets.values()) {
      const c = tileCenter(p.x, p.y);
      if (p.power) {
        drawCookie(c.x, c.y, 6 + Math.sin(t * 5 + p.x) * 0.8);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillText(p.ch, c.x, c.y + 1);
      }
    }
  }

  function drawCookie(x, y, r) {
    ctx.fillStyle = COLORS.cookie;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3416';
    for (const [dx, dy] of [[-0.35, -0.3], [0.3, -0.1], [-0.1, 0.4]]) {
      ctx.beginPath();
      ctx.arc(x + dx * r, y + dy * r, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBonus(t) {
    if (!game.bonus) return;
    const c = tileCenter(BONUS_TILE.x, BONUS_TILE.y);
    const x = c.x + T / 2;
    const y = c.y + Math.sin(t * 4) * 2;
    if (game.bonus.timer < 2 && Math.floor(t * 8) % 2) return;
    // a merged pull request badge
    roundRect(x - 16, y - 8, 32, 16, 4);
    ctx.fillStyle = '#8957e5';
    ctx.fill();
    ctx.strokeStyle = '#b48bff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 5); ctx.lineTo(x - 11, y + 5);
    ctx.moveTo(x - 11, y - 3); ctx.quadraticCurveTo(x - 11, y + 2, x - 6, y + 3);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const [px, py] of [[-11, -5], [-11, 5], [-6, 3]]) {
      ctx.beginPath();
      ctx.arc(x + px, y + py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = FONT_POP;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('PR', x - 2, y + 1);
  }

  // The monster from Commit Monster, shrunk to maze size and turned to face
  // its direction of travel.
  function drawMonsterAt(x, y, R, face, open, t, spin = 0) {
    const s = R / 40;
    const mouthAngle = 0.1 + open * 0.6;
    ctx.save();
    ctx.translate(x, y);
    if (face.x < 0) ctx.scale(-1, 1);
    else if (face.y < 0) ctx.rotate(-Math.PI / 2);
    else if (face.y > 0) ctx.rotate(Math.PI / 2);
    if (spin) ctx.rotate(spin);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2 * s, R * 0.6, R * 0.9, R * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2b7de9';
    ctx.beginPath();
    const spikes = 26;
    let started = false;
    for (let i = 0; i <= spikes; i++) {
      const ang = -Math.PI + (i / spikes) * Math.PI * 2;
      if (Math.abs(ang) < mouthAngle) {
        if (started) ctx.lineTo(0, 0);
        continue;
      }
      const jag = i % 2 ? R : R - 2.5 - Math.sin(t * 6 + i) * 0.8;
      const px = Math.cos(ang) * jag;
      const py = Math.sin(ang) * jag;
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(15, 60, 140, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, R - 1.5, Math.PI * 0.6, Math.PI * 0.92);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#12070c';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R - 1, -mouthAngle, mouthAngle);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a0d17';
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.arc(1, 0, R * 0.55, -mouthAngle * 0.8, mouthAngle * 0.8);
    ctx.closePath();
    ctx.fill();

    const look = Math.sin(t * 1.3) * 1.2 * s;
    drawEye(-6 * s, -R * 0.74, 5.2 * s, 2.4 * s, look + 1.5 * s, 0.8 * s, t);
    drawEye(14 * s, -R * 0.66, 4.4 * s, 2 * s, -look + 0.5 * s, -0.4 * s, t * 1.1 + 1);
    ctx.restore();
  }

  function drawEye(x, y, r, pr, dx, dy, t) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const jx = Math.sin(t * 7) * 0.5;
    const jy = Math.cos(t * 5) * 0.5;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + dx + jx, y + dy + jy, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(t) {
    if (game.hidePlayer) return;
    let open = Math.sin(player.mouth) * 0.5 + 0.5;
    let R = 12.5;
    let spin = 0;
    if (game.phase === 'dying') {
      const k = Math.min(1, player.deathT / 1.2);
      open = 1;
      R = 12.5 * (1 - k);
      spin = k * Math.PI * 6;
      if (R < 2.5) return;
    } else if (game.phase === 'intro' || game.phase === 'clear') {
      open = 0.15;
    }
    drawMonsterAt(player.x, player.y, R, player.face, open, t, spin);
    if (player.x < T) drawMonsterAt(player.x + COLS * T, player.y, R, player.face, open, t, spin);
    if (player.x > COLS * T - T) drawMonsterAt(player.x - COLS * T, player.y, R, player.face, open, t, spin);
  }

  function drawBug(g, t) {
    const bob = g.state === 'waiting' ? Math.sin(g.bob) * 3 : 0;
    const x = g.x;
    const y = g.y + bob;
    const face = stopped(g) ? DIRS.left : g.dir;
    const fright = g.mode === 'fright' && g.state !== 'eyes';
    const flashing = fright && game.fright < 2 && Math.floor(t * 8) % 2 === 0;

    ctx.save();
    ctx.translate(x, y);

    if (g.state !== 'eyes') {
      const body = flashing ? '#e6e8ee' : fright ? '#3b4bd8' : g.def.color;
      const dark = flashing ? '#9aa1b3' : fright ? '#1f2a8a' : 'rgba(0,0,0,0.3)';
      // legs
      ctx.strokeStyle = body;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const wig = Math.sin(t * 18 + i * 2) * 2;
        ctx.beginPath();
        ctx.moveTo(-5, i * 4);
        ctx.lineTo(-11, i * 4 + wig - 2);
        ctx.moveTo(5, i * 4);
        ctx.lineTo(11, i * 4 - wig - 2);
        ctx.stroke();
      }
      // antennae
      ctx.beginPath();
      ctx.moveTo(-3, -8); ctx.lineTo(-6, -13 + Math.sin(t * 5) * 1);
      ctx.moveTo(3, -8); ctx.lineTo(6, -13 - Math.sin(t * 5) * 1);
      ctx.stroke();
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(1, 9, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // body
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 1, 8, 9.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.beginPath();
      ctx.arc(0, -7, 5, 0, Math.PI * 2);
      ctx.fill();
      // wing seam and spots
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -3); ctx.lineTo(0, 10);
      ctx.stroke();
      ctx.fillStyle = dark;
      for (const [sx, sy] of [[-4, 1], [4, 2], [-3, 6], [3, 7]]) {
        ctx.beginPath();
        ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (fright) {
        // worried wavy mouth
        ctx.strokeStyle = flashing ? '#3b4bd8' : '#fff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-3, -5);
        ctx.lineTo(-1.5, -6.5); ctx.lineTo(0, -5); ctx.lineTo(1.5, -6.5); ctx.lineTo(3, -5);
        ctx.stroke();
      }
    }

    // eyes (always drawn: eyes are all that is left of a fixed bug)
    const ex = face.x * 1.5;
    const ey = face.y * 1.5;
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(side * 2.4, -8, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fright ? '#1f2a8a' : '#111';
      ctx.beginPath();
      ctx.arc(side * 2.4 + ex * 0.6, -8 + ey * 0.6, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBubble() {
    if (!game.bubble || game.hidePlayer) return;
    if (performance.now() > game.bubble.until) { game.bubble = null; return; }
    ctx.font = FONT_BUBBLE;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const text = game.bubble.text;
    const tw = ctx.measureText(text).width;
    const bw = tw + 18;
    const bh = 24;
    const ax = Math.max(T, Math.min(W - T, player.x));
    let bx = ax - 14;
    if (bx + bw > W - 6) bx = W - 6 - bw;
    if (bx < 6) bx = 6;
    let by = player.y - 22 - bh;
    let tailUp = false;
    if (by < 4) { by = player.y + 20; tailUp = true; }
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    roundRect(bx, by, bw, bh, 5);
    ctx.fill();
    ctx.stroke();
    const tx = Math.max(bx + 10, Math.min(bx + bw - 10, ax - 4));
    ctx.beginPath();
    if (tailUp) {
      ctx.moveTo(tx - 5, by); ctx.lineTo(tx + 1, by - 8); ctx.lineTo(tx + 6, by);
    } else {
      ctx.moveTo(tx - 5, by + bh); ctx.lineTo(tx + 1, by + bh + 8); ctx.lineTo(tx + 6, by + bh);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(tx - 4, tailUp ? by - 1 : by + bh - 1, 10, 3);
    ctx.fillStyle = '#111';
    ctx.fillText(text, bx + 9, by + bh / 2 + 1);
  }

  function drawPops() {
    const now = performance.now();
    ctx.font = FONT_POP;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    game.pops = game.pops.filter((p) => p.until > now);
    for (const p of game.pops) {
      const k = 1 - (p.until - now) / 1000;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillText(p.text, p.x, p.y - k * 14);
    }
    ctx.globalAlpha = 1;
  }

  function drawBanner(text, color) {
    const c = tileCenter(BONUS_TILE.x, BONUS_TILE.y);
    ctx.font = FONT_BIG;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, c.x + T / 2, c.y + 1);
  }

  function drawStatusBar(t) {
    const top = ROWS * T;
    ctx.fillStyle = COLORS.barBg;
    ctx.fillRect(0, top, W, BAR_H);
    ctx.fillStyle = 'rgba(43, 125, 233, 0.35)';
    ctx.fillRect(0, top, W, 1);

    // spare lives, as tiny monsters
    const spare = Math.max(0, game.lives - 1);
    for (let i = 0; i < spare; i++) {
      drawMonsterAt(18 + i * 24, top + BAR_H / 2, 7.5, DIRS.right, 0.3, t + i);
    }

    ctx.font = FONT_BAR;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = 'left';
    const pt = tileOf(player);
    const col = Math.max(1, Math.min(COLS, pt.x + 1));
    ctx.fillText('main*  Ln ' + (pt.y + 1) + ', Col ' + col, 18 + Math.max(spare, 0) * 24 + 10, top + BAR_H / 2 + 1);
    ctx.textAlign = 'right';
    const left = pellets.size;
    ctx.fillText('level ' + game.level + '   ' + left + '/' + totalPellets + ' glyphs', W - 12, top + BAR_H / 2 + 1);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function draw(t) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    const flash = game.phase === 'clear' && Math.floor(game.timer / 250) % 2 === 0 && game.timer < 1800;
    ctx.drawImage(flash ? wallFlashLayer : wallLayer, 0, 0, W, ROWS * T);

    drawPellets(t);
    drawBonus(t);
    if (game.phase !== 'clear') {
      for (const g of bugs) {
        if (game.phase === 'eaten' && g.state === 'eyes' && g === game.justFixed) continue;
        drawBug(g, t);
      }
    }
    if (game.fright > 0 && game.phase === 'playing') {
      ctx.fillStyle = 'rgba(43, 125, 233, 0.05)';
      ctx.fillRect(0, 0, W, ROWS * T);
    }
    drawPlayer(t);
    drawPops();
    drawBubble();
    if (game.phase === 'intro') drawBanner('READY TO NOM', COLORS.cookie);
    drawStatusBar(t);
  }

  // ---- Loop ---------------------------------------------------------------

  function frame(ts) {
    if (!visible) { game.lastTs = 0; requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (ts - (game.lastTs || ts)) / 1000);
    game.lastTs = ts;
    const t = ts / 1000;

    switch (game.phase) {
      case 'playing':
        step(dt);
        break;
      case 'intro':
        game.timer -= dt * 1000;
        if (game.timer <= 0) game.phase = 'playing';
        break;
      case 'eaten':
        game.timer -= dt * 1000;
        if (game.timer <= 0) { game.phase = 'playing'; game.justFixed = null; }
        break;
      case 'dying':
        player.deathT += dt;
        game.timer -= dt * 1000;
        if (game.timer <= 0) afterDeath();
        break;
      case 'clear':
        game.timer -= dt * 1000;
        if (game.timer <= 0) {
          game.level++;
          updateStats();
          newLevel();
          enterIntro(1600);
          emit('level', { level: game.level, score: game.score });
        }
        break;
      default:
        break;
    }

    draw(t);
    requestAnimationFrame(frame);
  }

  // ---- Overlay and controls ----------------------------------------------

  function showOverlay(title, msg, btnLabel) {
    overlayTitle.textContent = title;
    overlayMsg.innerHTML = msg;
    startBtn.textContent = btnLabel;
    overlay.classList.remove('is-hidden');
    syncToggle();
  }

  function hideOverlay() {
    overlay.classList.add('is-hidden');
    syncToggle();
  }

  function syncToggle() {
    if (!toggleBtn) return;
    const live = ['playing', 'intro', 'eaten'].includes(game.phase);
    toggleBtn.textContent = live ? 'Pause' : game.phase === 'paused' ? 'Resume' : 'Play';
  }

  function startGame() {
    ensureAudio();
    if (audio && audio.state === 'suspended') audio.resume();
    newGame();
    hideOverlay();
    enterIntro(2000);
    syncToggle();
    emit('start', { glyphs: totalPellets, bugs: bugs.length });
  }

  function togglePause() {
    if (game.phase === 'paused') {
      game.phase = game.pausedBefore;
      game.lastTs = 0;
      hideOverlay();
    } else if (['playing', 'intro', 'eaten'].includes(game.phase)) {
      game.pausedBefore = game.phase;
      game.phase = 'paused';
      showOverlay('PAUSED', 'me take coffee break', 'Resume');
    }
  }

  function gameOver() {
    game.phase = 'over';
    try {
      localStorage.setItem(STORAGE_KEY, String(game.best));
    } catch (e) { /* storage unavailable */ }
    showOverlay('BUGS WIN', 'score: ' + game.score + ' &middot; level ' + game.level + '<br>for now...', 'Feed Me Again');
    emit('over', { score: game.score, level: game.level, bugsFixed: game.bugsFixed });
  }

  // The workbench forwards keys here while muncher.game is the active tab.
  // Returns true when the key was consumed.
  const KEYS = {
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowDown: 'down', s: 'down', S: 'down',
    ArrowRight: 'right', d: 'right', D: 'right',
  };

  function handleKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (['playing', 'intro', 'eaten', 'paused'].includes(game.phase)) {
        togglePause();
        e.preventDefault();
        return true;
      }
      return false;
    }
    if (game.phase === 'ready' || game.phase === 'over') {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target && e.target.tagName === 'BUTTON') return true; // the button's own click handles it
        startGame();
        e.preventDefault();
        return true;
      }
      return false;
    }
    const name = KEYS[e.key];
    if (!name) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); return true; }
      return false;
    }
    e.preventDefault();
    if (game.phase === 'paused') togglePause();
    setWant(DIRS[name]);
    return true;
  }

  function pauseIfLive() {
    if (['playing', 'intro', 'eaten'].includes(game.phase)) togglePause();
  }

  startBtn.addEventListener('click', () => {
    if (game.phase === 'paused') togglePause();
    else startGame();
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (game.phase === 'paused' || ['playing', 'intro', 'eaten'].includes(game.phase)) togglePause();
      else startGame();
    });
  }

  container.querySelectorAll('.game-pad-btn').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      ensureAudio();
      if (game.phase === 'ready' || game.phase === 'over') { startGame(); return; }
      if (game.phase === 'paused') togglePause();
      setWant(DIRS[btn.dataset.dir]);
    });
  });

  // swipe anywhere on the maze
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    const t0 = e.changedTouches[0];
    touchStart = { x: t0.clientX, y: t0.clientY, used: false };
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!touchStart || touchStart.used) return;
    const t0 = e.changedTouches[0];
    const dx = t0.clientX - touchStart.x;
    const dy = t0.clientY - touchStart.y;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    touchStart.used = true;
    if (game.phase === 'paused') togglePause();
    if (Math.abs(dx) > Math.abs(dy)) setWant(dx > 0 ? DIRS.right : DIRS.left);
    else setWant(dy > 0 ? DIRS.down : DIRS.up);
  }, { passive: true });
  canvas.addEventListener('touchend', () => { touchStart = null; }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseIfLive();
  });

  window.addEventListener('resize', () => { if (visible) fitCanvas(); });

  // ---- Workbench API ------------------------------------------------------

  api.key = handleKey;
  api.start = () => { if (game.phase !== 'paused' && !['playing', 'intro', 'eaten'].includes(game.phase)) startGame(); else if (game.phase === 'paused') togglePause(); };
  api.pause = pauseIfLive;
  api.toggle = () => { if (game.phase === 'paused' || ['playing', 'intro', 'eaten'].includes(game.phase)) togglePause(); else startGame(); };
  api.setVisible = (v) => {
    visible = !!v;
    if (visible) { fitCanvas(); game.lastTs = 0; } else pauseIfLive();
  };
  Object.defineProperty(api, 'playing', { get: () => ['playing', 'intro', 'eaten'].includes(game.phase) });
  Object.defineProperty(api, 'score', { get: () => game.score });
  Object.defineProperty(api, 'phase', { get: () => game.phase });

  // ---- Boot ---------------------------------------------------------------

  const boot = () => {
    buildGrid();
    fitCanvas();
    newGame();
    showOverlay('ME WANT CODE', 'eat every glyph in the repo. cookies make the bugs edible.<br>arrows or wasd to move, p to pause', 'Feed Me');
    requestAnimationFrame(frame);
  };
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load(FONT_GLYPH),
      document.fonts.load(FONT_BUBBLE),
    ]).then(boot, boot);
  } else {
    boot();
  }
})();
