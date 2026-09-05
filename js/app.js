/* Commit Monster — full-page edition. A furry blue monster chomps his way
   through a code editor that looks a lot like Visual Studio Code. Everything
   in the editor pane is drawn on a canvas; the surrounding workbench (activity
   bar, explorer, tabs, panel, status bar, command palette) is plain DOM. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SNACKS = window.SNACKS || [];
  const byId = Object.fromEntries(SNACKS.map((s) => [s.id, s]));
  const DEFAULT_ID = SNACKS[0] ? SNACKS[0].id : null;

  // ---- DOM ----------------------------------------------------------------

  const workbench = $('workbench');
  const sidebar = $('sidebar');
  const panel = $('panel');
  const statusbar = document.querySelector('.statusbar');
  const editorEl = $('editor');
  const canvas = $('cm-screen');
  const ctx = canvas.getContext('2d');
  const avatar = $('cm-avatar');
  const actx = avatar.getContext('2d');

  const overlay = $('cm-overlay');
  const overlayTitle = $('cm-overlay-title');
  const overlayMsg = $('cm-overlay-msg');
  const overlayStart = $('cm-overlay-start');
  const overlayLater = $('cm-overlay-later');
  const startBtn = $('cm-start');
  const speedInput = $('cm-speed');
  const speedOut = $('cm-speed-out');
  const soundCheck = $('cm-sound');

  const input = $('cm-input');
  const textGutter = $('text-gutter');
  const editorText = $('editor-text');
  const editorEmpty = $('editor-empty');
  const editorReadme = $('editor-readme');

  const statLines = $('cm-lines');
  const statChars = $('cm-chars');
  const statBugs = $('cm-bugs');
  const statDebt = $('cm-debt');

  const tabsEl = $('tabs');
  const fileList = $('file-list');
  const fileTree = $('file-tree');
  const crumbFile = $('crumb-file');
  const terminalEl = $('terminal');
  const outputEl = $('output');
  const debugConsoleEl = $('debug-console');
  const problemsEl = $('problems');
  const problemsBadge = $('problems-badge');
  const timelineEl = $('timeline');
  const scmList = $('scm-list');
  const scmCount = $('scm-count');
  const scmBadge = $('scm-badge');
  const paletteEl = $('palette');
  const paletteInput = $('palette-input');
  const paletteList = $('palette-list');
  const toastsEl = $('toasts');

  const stPos = $('st-pos');
  const stMood = $('st-mood');
  const stLang = $('st-lang');
  const stHunger = $('st-hunger');
  const stWarnings = $('st-warnings');
  const wHunger = $('w-hunger');
  const wState = $('w-state');
  const wStomach = $('w-stomach');
  const wRemaining = $('w-remaining');
  const callstack = $('callstack');
  const outlineText = $('outline-text');
  const searchInput = $('search-input');
  const searchResults = $('search-results');

  // ---- Flavor -------------------------------------------------------------

  const QUOTES = [
    'OM NOM NOM NOM', 'ME LOVE CODE', 'C IS FOR CODE', 'TASTY SEMICOLON',
    'DELICIOUS RECURSION', 'ME EAT WHOLE FILE', 'CRUNCHY BRACES', 'NOM NOM NOM',
    'CODE GOOD ENOUGH FOR ME', 'MORE! MORE!', 'ME NEVER FULL', 'MMM, INDENTATION',
    'ME NOT NEED CODE REVIEW', 'LINT THIS', 'ME MERGE WITH MOUTH',
  ];

  const REACTIONS = [
    [/cookie/i, 'COOKIE!!!'],
    [/forgive|blessing|do good/i, 'ME FORGIVE. ME ALSO EAT'],
    [/malloc|memcpy|memset/i, 'RAW MEMORY. CRUNCHY'],
    [/heap/i, 'ME EAT WHOLE HEAP'],
    [/mutex|lock\(/i, 'ME NOT WAIT FOR LOCK'],
    [/unsafe|panic!/i, 'OOH, SPICY'],
    [/todo/i, 'TODO? ME DO IT NOW'],
    [/fixme/i, 'ME FIX IT. WITH MOUTH'],
    [/\bbug\b/i, 'ME EAT BUG. BUG TASTY'],
    [/hack|xxx/i, 'MMM, SPICY'],
    [/import|#include|use /i, 'ME LOVE DEPENDENCIES'],
    [/return/i, 'NO RETURN. ONLY EAT'],
    [/panic|assert|throw/i, 'THAT ONE CRUNCHY'],
    [/print|console\.log|fmt\./i, 'ME EAT DEBUG LOG TOO'],
    [/^\s*\/\/|^\s*#|^\s*\/\*|^\s*"""/, 'COMMENTS SO SWEET'],
  ];

  const BUG_RE = /todo|fixme|hack|xxx|\bbug\b/i;

  function bugKind(text) {
    const m = text.match(BUG_RE);
    const w = m ? m[0].toUpperCase() : 'BUG';
    if (w === 'TODO') return 'TODO left in code';
    if (w === 'FIXME') return 'FIXME never fixed';
    if (w === 'HACK' || w === 'XXX') return 'Suspicious hack';
    return 'Bug mentioned in source';
  }

  // ---- Syntax colors (Dark+) ------------------------------------------------

  const C = {
    text: '#d4d4d4',
    comment: '#6a9955',
    string: '#ce9178',
    number: '#b5cea8',
    keyword: '#569cd6',
    control: '#c586c0',
    func: '#dcdcaa',
    type: '#4ec9b0',
    variable: '#9cdcfe',
    constant: '#4fc1ff',
    punct: '#d4d4d4',
    brackets: ['#ffd700', '#da70d6', '#179fff'],
    lineNo: '#858585',
    lineNoActive: '#c6c6c6',
    editorBg: '#1e1e1e',
    lineBorder: '#282828',
    indentGuide: '#404040',
    scrollbar: 'rgba(121, 121, 121, 0.4)',
    minimapSlider: 'rgba(121, 121, 121, 0.2)',
  };

  const CONTROL = new Set((
    'if else for while do switch case break continue return try catch finally ' +
    'throw await yield import export from default with as pass raise elif except ' +
    'match defer go use mod loop where'
  ).split(' '));

  const KEYWORDS = new Set((
    'const let var function new class extends typeof instanceof of in this null ' +
    'undefined true false def lambda not and or is None True False self func ' +
    'package type struct interface map chan nil fn pub mut impl enum crate Self ' +
    'static int void char unsigned long double float typedef sizeof size_t bool ' +
    'string uint8_t u32 u64 i32 i64 usize sds ssize_t extern inline register ' +
    'volatile union goto async'
  ).split(' '));

  // Returns per-character colors for one line. `hl` carries block-comment and
  // bracket-depth state across lines.
  function colorize(text, hl) {
    const colors = new Array(text.length).fill(C.text);
    let i = 0;
    while (i < text.length) {
      const rest = text.slice(i);
      let m;
      if (hl.block) {
        const end = rest.indexOf('*/');
        const len = end < 0 ? rest.length : end + 2;
        colors.fill(C.comment, i, i + len);
        if (end >= 0) hl.block = false;
        i += len;
      } else if (rest.startsWith('/*')) {
        hl.block = true;
      } else if ((m = rest.match(/^(#\s*(include|define|ifndef|ifdef|endif|if|else|elif|pragma|undef)\b)/))) {
        colors.fill(C.control, i, i + m[0].length);
        i += m[0].length;
      } else if ((m = rest.match(/^#\[[^\]]*\]?/))) {
        colors.fill(C.control, i, i + m[0].length);
        i += m[0].length;
      } else if ((m = rest.match(/^(\/\/|#|""").*/))) {
        colors.fill(C.comment, i, i + m[0].length);
        i += m[0].length;
      } else if ((m = rest.match(/^("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`[^`]*`?)/))) {
        colors.fill(C.string, i, i + m[0].length);
        i += m[0].length;
      } else if ((m = rest.match(/^\d[\d_.]*\w*/))) {
        colors.fill(C.number, i, i + m[0].length);
        i += m[0].length;
      } else if ((m = rest.match(/^[A-Za-z_][\w']*/))) {
        const word = m[0];
        const after = rest.slice(word.length).match(/^\s*(\(|!\()/);
        let color;
        if (CONTROL.has(word)) color = C.control;
        else if (KEYWORDS.has(word)) color = C.keyword;
        else if (after) color = C.func;
        else if (/^[A-Z][A-Z0-9_]+$/.test(word)) color = C.constant;
        else if (/^[A-Z]/.test(word)) color = C.type;
        else color = C.variable;
        colors.fill(color, i, i + word.length);
        i += word.length;
      } else if ((m = rest.match(/^[{([]/))) {
        colors[i] = C.brackets[hl.depth % 3];
        hl.depth += 1;
        i += 1;
      } else if ((m = rest.match(/^[})\]]/))) {
        hl.depth = Math.max(0, hl.depth - 1);
        colors[i] = C.brackets[hl.depth % 3];
        i += 1;
      } else if ((m = rest.match(/^[;,.:=<>+\-*/&|!?@#%^~]+/))) {
        colors.fill(C.punct, i, i + m[0].length);
        i += m[0].length;
      } else {
        i += 1;
      }
    }
    return colors;
  }

  // ---- Canvas geometry ----------------------------------------------------

  const LINE_H = 20;
  const FONT = '14px Menlo, Monaco, "Courier New", monospace';
  const BUBBLE_FONT = '11px "Press Start 2P", monospace';
  const GUTTER = 66;       // content starts here
  const NUM_RIGHT = 48;    // right edge of the line numbers
  const SCROLLBAR_W = 14;
  const TOP_ROWS = 2.2;    // blank rows above line 1 so the monster's head fits
  const R = 38;            // monster radius

  let W = 640;
  let H = 400;
  let MM = 90;             // minimap width, 0 when the editor is narrow
  let ROWS = 20;
  let charW = 8.4;

  function fitCanvas() {
    const rect = editorEl.getBoundingClientRect();
    W = Math.max(240, Math.round(rect.width));
    H = Math.max(120, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT;
    charW = ctx.measureText('M').width || 8.4;
    MM = W >= 620 ? 90 : 0;
    ROWS = Math.floor(H / LINE_H);
    reflow();
  }

  function fitAvatar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    avatar.width = Math.round(96 * dpr);
    avatar.height = Math.round(72 * dpr);
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function textCols() {
    return Math.max(20, Math.floor((W - MM - GUTTER - SCROLLBAR_W - 8) / charW));
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

  function soundOn() {
    return soundCheck.checked;
  }

  function playNom(strength = 1) {
    if (!audio || !soundOn()) return;
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = audio.crunch;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600 + Math.random() * 600;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.35 * strength, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const osc = audio.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    const og = audio.createGain();
    og.gain.setValueAtTime(0.12 * strength, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(filter).connect(gain).connect(audio.destination);
    osc.connect(og).connect(audio.destination);
    src.start(t);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  function playBurp() {
    if (!audio || !soundOn()) return;
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

  // ---- State --------------------------------------------------------------

  const state = {
    running: false,
    paused: false,
    done: false,
    fileId: null,     // snack currently loaded in the canvas
    source: '',       // normalized source text
    lines: [],        // { text, colors, eaten, bug, rawStart, rawLine }
    li: 0,
    pos: 0,
    scroll: 0,
    crumbs: [],
    bubble: null,
    nextQuoteAt: 0,
    reactCooldown: 0,
    frenzyUntil: 0,
    carry: 0,
    lastNom: 0,
    stats: { lines: 0, chars: 0, bugs: 0, total: 0 },
    lastTs: 0,
  };

  const ui = {
    openTabs: [],
    activeId: null,
    view: 'explorer',
    eaten: new Set(),
    overlayHidden: false,
    lastPos: '',
  };

  let mmCanvas = null;
  let mmCtx = null;

  function normalize(src) {
    return src.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  }

  function prepare(source) {
    const cols = textCols();
    const lines = [];
    const raw = source.split('\n');
    const hl = { block: false, depth: 0 };
    let offset = 0;
    for (let r = 0; r < raw.length; r++) {
      const line = raw[r];
      const chunks = [];
      if (line.length <= cols) chunks.push(line);
      else for (let i = 0; i < line.length; i += cols) chunks.push(line.slice(i, i + cols));
      let sub = 0;
      for (const text of chunks) {
        lines.push({
          text,
          colors: colorize(text, hl),
          eaten: 0,
          bug: BUG_RE.test(text),
          rawStart: offset + sub,
          rawLine: r,
        });
        sub += text.length;
      }
      offset += line.length + 1;
      if (lines.length > 600) break;
    }
    while (lines.length > 1 && lines[lines.length - 1].text.trim() === '') lines.pop();
    return lines;
  }

  // Re-wrap the current source for the current editor width, keeping the
  // monster at the same character in the text.
  function reflow() {
    if (!state.source) return;
    const old = state.lines;
    let abs = 0;
    if (state.li >= old.length) abs = Infinity;
    else if (old.length) abs = old[state.li].rawStart + old[state.li].eaten;
    const lines = prepare(state.source);
    let li = lines.length;
    for (let i = 0; i < lines.length; i++) {
      const next = lines[i + 1];
      if (lines[i].rawStart <= abs && (!next || next.rawStart > abs)) { li = i; break; }
    }
    for (let i = 0; i < lines.length; i++) {
      if (i < li) lines[i].eaten = lines[i].text.length;
      else if (i === li) lines[i].eaten = Math.min(lines[i].text.length, abs - lines[i].rawStart);
    }
    state.lines = lines;
    state.li = li;
    state.pos = li < lines.length ? lines[li].eaten : 0;
    buildMinimap();
    renderProblems();
  }

  function reset(source) {
    state.source = normalize(source);
    state.lines = prepare(state.source);
    state.li = 0;
    state.pos = 0;
    state.scroll = 0;
    state.crumbs = [];
    state.bubble = null;
    state.frenzyUntil = 0;
    state.reactCooldown = 0;
    state.carry = 0;
    state.done = false;
    state.paused = false;
    state.running = false;
    state.stats = {
      lines: 0,
      chars: 0,
      bugs: 0,
      total: state.lines.reduce((n, l) => n + l.text.replace(/\s/g, '').length, 0),
    };
    buildMinimap();
    renderProblems();
    updateStats();
    updateOutline();
  }

  function updateStats() {
    const s = state.stats;
    statLines.textContent = s.lines;
    statChars.textContent = s.chars;
    statBugs.textContent = s.bugs;
    const left = s.total ? Math.round((1 - s.chars / s.total) * 100) : 0;
    statDebt.textContent = `${Math.max(0, left)}%`;
    wStomach.textContent = s.chars;
    wRemaining.textContent = Math.max(0, s.total - s.chars);
    wHunger.textContent = speedInput.value;
    const mood = state.running
      ? (performance.now() < state.frenzyUntil ? 'frenzy' : 'eating')
      : state.done ? 'full' : state.paused ? 'paused' : 'hungry';
    wState.textContent = `"${mood}"`;
  }

  function updateOutline() {
    const src = state.source || '';
    const syms = [];
    const re = /^\s*(?:(?:static|pub|async|export|unsigned)\s+)*(?:fn|func|def|function|int|char|void|sds|class|impl|struct|type)\b[^(=\n]*?([A-Za-z_][\w:<>]*)\s*(?:\(|\{|:|<|$)/gm;
    let m;
    while ((m = re.exec(src)) && syms.length < 12) syms.push(m[1]);
    outlineText.textContent = syms.length
      ? syms.map((s) => `ƒ ${s}`).join('\n')
      : 'No symbols found in document. Only crumbs.';
    outlineText.style.whiteSpace = 'pre';
    outlineText.style.fontFamily = 'var(--font-mono)';
  }

  // ---- Minimap ------------------------------------------------------------

  function buildMinimap() {
    if (!mmCanvas) {
      mmCanvas = document.createElement('canvas');
      mmCtx = mmCanvas.getContext('2d');
    }
    mmCanvas.width = Math.max(1, MM);
    mmCanvas.height = Math.max(1, state.lines.length * 2);
    if (!MM) return;
    const c = mmCtx;
    c.clearRect(0, 0, mmCanvas.width, mmCanvas.height);
    for (let i = 0; i < state.lines.length; i++) {
      const line = state.lines[i];
      const start = i < state.li ? line.text.length : (i === state.li ? line.eaten : 0);
      let runStart = -1;
      let runColor = null;
      for (let col = start; col <= line.text.length && col < MM - 6; col++) {
        const ch = line.text[col];
        const color = ch && ch !== ' ' ? line.colors[col] : null;
        if (color !== runColor) {
          if (runColor) {
            c.fillStyle = runColor;
            c.fillRect(runStart, i * 2, col - runStart, 2);
          }
          runStart = col;
          runColor = color;
        }
      }
    }
  }

  function minimapEat(li, col) {
    if (!MM || !mmCtx) return;
    mmCtx.clearRect(col, li * 2, 1, 2);
  }

  // ---- Eating -------------------------------------------------------------

  function say(text, ms = 1600) {
    state.bubble = { text, until: performance.now() + ms };
  }

  function charsPerSecond() {
    const speed = Number(speedInput.value) || 5;
    let cps = 8 * Math.pow(1.45, speed);
    if (performance.now() < state.frenzyUntil) cps *= 3;
    return cps;
  }

  function monsterAnchor() {
    const line = state.lines[state.li];
    const eaten = line ? Math.min(state.pos, line.text.length) : 0;
    const x = GUTTER + eaten * charW;
    const y = (state.li - state.scroll + TOP_ROWS) * LINE_H + LINE_H / 2;
    return { x, y };
  }

  function spawnCrumb(ch, color, x, y) {
    const frenzy = performance.now() < state.frenzyUntil;
    state.crumbs.push({
      ch, color, x, y,
      vx: -(40 + Math.random() * 120) * (frenzy ? 1.6 : 1),
      vy: -(80 + Math.random() * 160),
      rot: (Math.random() - 0.5) * 2,
      vr: (Math.random() - 0.5) * 12,
      life: 1,
      size: 0.6 + Math.random() * 0.7,
    });
    if (state.crumbs.length > 220) state.crumbs.splice(0, state.crumbs.length - 220);
  }

  function react(text, now) {
    if (now < state.reactCooldown) return;
    for (const [re, quote] of REACTIONS) {
      if (re.test(text) && Math.random() < 0.5) {
        say(quote);
        state.nextQuoteAt = now + 2500;
        state.reactCooldown = now + 1800;
        tlog(`<span class="t-nom">monster:</span> ${esc(quote)}`);
        break;
      }
    }
  }

  const pendingLog = { lines: 0, chars: 0, last: 0 };

  function step(dt) {
    const now = performance.now();
    const line = state.lines[state.li];
    if (!line) {
      finish();
      return;
    }
    if (state.pos === 0 && line.eaten === 0 && line.text.trim() !== '') react(line.text, now);

    let budget = charsPerSecond() * dt + state.carry;
    state.carry = 0;
    while (budget > 0 && state.li < state.lines.length) {
      const cur = state.lines[state.li];
      if (cur.eaten >= cur.text.length) {
        if (cur.text.trim() !== '') {
          state.stats.lines += 1;
          pendingLog.lines += 1;
        }
        if (cur.bug) {
          state.stats.bugs += 1;
          markProblemEaten(state.li);
        }
        state.li += 1;
        state.pos = 0;
        budget -= 0.4;
        if (state.li >= state.lines.length) break;
        const next = state.lines[state.li];
        if (next.text.trim() !== '') react(next.text, now);
        continue;
      }
      const ch = cur.text[cur.eaten];
      const cost = ch === ' ' ? 0.2 : 1;
      if (budget < cost) {
        state.pos = cur.eaten + budget / cost;
        state.carry = budget;
        budget = 0;
        break;
      }
      budget -= cost;
      if (ch !== ' ') {
        state.stats.chars += 1;
        pendingLog.chars += 1;
        const a = monsterAnchor();
        spawnCrumb(ch, cur.colors[cur.eaten], a.x + charW * 0.5, a.y);
        minimapEat(state.li, cur.eaten);
        if (now - state.lastNom > 90) {
          playNom(1 + (now < state.frenzyUntil ? 0.4 : 0));
          state.lastNom = now;
        }
      }
      cur.eaten += 1;
      state.pos = cur.eaten;
    }

    if (now > state.nextQuoteAt && !state.bubble) {
      say(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      state.nextQuoteAt = now + 2600 + Math.random() * 3000;
    }
    if (state.bubble && now > state.bubble.until) state.bubble = null;

    if (pendingLog.lines && now - pendingLog.last > 900) {
      tlog(`<span class="t-dim">nom</span> ate ${pendingLog.lines} line${pendingLog.lines === 1 ? '' : 's'}, ${pendingLog.chars} chars <span class="t-dim">${esc(fileName(state.fileId))}:${Math.min(state.li + 1, state.lines.length)}</span>`);
      pendingLog.lines = 0;
      pendingLog.chars = 0;
      pendingLog.last = now;
    }
    updateStats();
  }

  function finish() {
    state.running = false;
    state.done = true;
    state.stats.chars = state.stats.total;
    state.bubble = null;
    pendingLog.lines = 0;
    pendingLog.chars = 0;
    updateStats();
    playBurp();
    const s = state.stats;
    const bugs = `${s.bugs} bug${s.bugs === 1 ? '' : 's'}`;
    showOverlay(
      'ME FULL.',
      `${s.lines} lines, ${s.chars} characters, ${bugs} eaten.<br>tech debt: gone. codebase: also gone.<br>...me not full. more code?`,
      'Feed Me Again',
    );
    startBtn.textContent = 'Feed Me Again';
    if (state.fileId) ui.eaten.add(state.fileId);
    const name = fileName(state.fileId);
    tlog(`<span class="t-err">BURRRP.</span>`);
    tlog(`<span class="t-dim">done</span> ${esc(name)} deleted: ${s.lines} lines, ${s.chars} chars, ${bugs} resolved by removal.`);
    newPrompt();
    outLog(`[Commit Monster] finished ${name}. Stomach: ${s.chars} chars.`);
    addTimeline(`Ate ${name} (${s.lines} lines, ${bugs})`);
    showToast(`<b>${esc(name)}</b> has been eaten. ${bugs} resolved, 0 lines remaining. Commit the change?`, {
      actions: [
        { label: 'Commit', run: () => { switchView('scm'); commit(); } },
        { label: 'More code', run: () => openPalette('files') },
      ],
    });
    renderTabs();
    renderFiles();
    renderScm();
    setMood();
  }

  // ---- Drawing ------------------------------------------------------------

  function drawEditor() {
    ctx.fillStyle = C.editorBg;
    ctx.fillRect(0, 0, W, H);
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    const textW = W - MM - SCROLLBAR_W;
    const first = Math.max(0, Math.floor(state.scroll) - 1);
    const last = Math.min(state.lines.length - 1, first + ROWS + 3);
    for (let i = first; i <= last; i++) {
      const line = state.lines[i];
      const y = (i - state.scroll + TOP_ROWS) * LINE_H + LINE_H / 2;
      if (y < -LINE_H || y > H + LINE_H) continue;
      if (i === state.li && (state.running || state.paused)) {
        ctx.strokeStyle = C.lineBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(GUTTER - 6, y - LINE_H / 2 + 1, textW - GUTTER + 6, LINE_H - 2);
      }
      ctx.textAlign = 'right';
      ctx.fillStyle = i === state.li ? C.lineNoActive : C.lineNo;
      ctx.fillText(String(line.rawLine + 1), NUM_RIGHT, y);
      ctx.textAlign = 'left';
      const startCol = i < state.li ? line.text.length : (i === state.li ? line.eaten : 0);
      // indent guides for the part of the line that still exists
      const indent = line.text.match(/^ */)[0].length;
      if (indent >= 4 && startCol < line.text.length) {
        ctx.fillStyle = C.indentGuide;
        for (let g = 4; g < indent && g < line.text.length; g += 4) {
          if (g < startCol) continue;
          ctx.fillRect(Math.round(GUTTER + g * charW), y - LINE_H / 2, 1, LINE_H);
        }
      }
      let c = startCol;
      while (c < line.text.length) {
        if (line.text[c] === ' ') { c += 1; continue; }
        const color = line.colors[c];
        let e = c + 1;
        while (e < line.text.length && line.text[e] !== ' ' && line.colors[e] === color) e += 1;
        ctx.fillStyle = color;
        ctx.fillText(line.text.slice(c, e), GUTTER + c * charW, y);
        c = e;
      }
    }
    // vertical scrollbar
    const total = state.lines.length + TOP_ROWS + 1.5;
    if (total > ROWS) {
      const sh = Math.max(20, (ROWS / total) * H);
      const sy = (state.scroll / total) * H;
      ctx.fillStyle = C.scrollbar;
      ctx.fillRect(textW, sy, SCROLLBAR_W, sh);
    }
  }

  function drawMinimap() {
    if (!MM || !mmCanvas) return;
    const x0 = W - MM;
    const grad = ctx.createLinearGradient(x0 - 6, 0, x0, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0 - 6, 0, 6, H);
    const mmH = mmCanvas.height;
    const maxScroll = Math.max(1, state.lines.length - ROWS);
    const offY = mmH > H ? Math.min(mmH - H, (state.scroll / maxScroll) * (mmH - H)) : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, MM, H);
    ctx.clip();
    ctx.globalAlpha = 0.75;
    ctx.drawImage(mmCanvas, x0 + 2, 4 - offY);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.minimapSlider;
    ctx.fillRect(x0, 4 + state.scroll * 2 - offY, MM, ROWS * 2);
    ctx.restore();
  }

  function drawCrumbs(dt) {
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = state.crumbs.length - 1; i >= 0; i--) {
      const p = state.crumbs[i];
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt * 0.9;
      if (p.life <= 0 || p.y > H + 30) {
        state.crumbs.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(p.size, p.size);
      ctx.fillStyle = p.color;
      ctx.fillText(p.ch, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Draws the monster centered on the current origin of `c`, facing right.
  function drawMonsterShape(c, radius, t, open, frenzy) {
    const mouthAngle = 0.12 + open * 0.55;
    if (frenzy) c.rotate((Math.random() - 0.5) * 0.12);

    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(4, radius * 0.55, radius * 0.9, radius * 0.35, 0, 0, Math.PI * 2);
    c.fill();

    // fur: jagged outline with the mouth wedge cut out
    c.fillStyle = '#2b7de9';
    c.beginPath();
    const spikes = 44;
    let started = false;
    for (let i = 0; i <= spikes; i++) {
      const ang = -Math.PI + (i / spikes) * Math.PI * 2;
      if (Math.abs(ang) < mouthAngle) {
        if (started) c.lineTo(0, 0);
        continue;
      }
      const jag = i % 2 ? radius : radius - 5 - Math.sin(t * 6 + i) * 1.5;
      const x = Math.cos(ang) * jag;
      const y = Math.sin(ang) * jag;
      if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
    }
    c.closePath();
    c.fill();

    c.fillStyle = 'rgba(15, 60, 140, 0.35)';
    c.beginPath();
    c.arc(0, 0, radius - 3, Math.PI * 0.6, Math.PI * 0.92);
    c.lineTo(0, 0);
    c.closePath();
    c.fill();

    c.fillStyle = '#12070c';
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, radius - 2, -mouthAngle, mouthAngle);
    c.closePath();
    c.fill();
    c.fillStyle = '#3a0d17';
    c.beginPath();
    c.moveTo(2, 0);
    c.arc(2, 0, radius * 0.55, -mouthAngle * 0.8, mouthAngle * 0.8);
    c.closePath();
    c.fill();

    const look = Math.sin(t * 1.3) * 2;
    const s = radius / 40;
    drawEye(c, -6 * s, -radius * 0.78, 13 * s, 6 * s, (look + 2) * s, 2 * s, t);
    drawEye(c, 18 * s, -radius * 0.7, 11 * s, 5 * s, (-look + 1) * s, -1 * s, t * 1.1 + 1);
  }

  function drawEye(c, x, y, r, pr, dx, dy, t) {
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 1.5;
    c.stroke();
    const jx = Math.sin(t * 7) * 1.2;
    const jy = Math.cos(t * 5) * 1.2;
    c.fillStyle = '#111';
    c.beginPath();
    c.arc(x + dx + jx, y + dy + jy, pr, 0, Math.PI * 2);
    c.fill();
  }

  function mouthOpen(t) {
    const frenzy = performance.now() < state.frenzyUntil;
    const chompRate = frenzy ? 22 : (state.running ? 11 : 2.5);
    const open = state.running || state.done
      ? (Math.sin(t * chompRate) * 0.5 + 0.5)
      : 0.15 + Math.sin(t * 2) * 0.05;
    return { open, frenzy, chompRate };
  }

  function drawMonster(t) {
    if (!state.lines.length) return;
    const a = monsterAnchor();
    const { open, frenzy, chompRate } = mouthOpen(t);
    const wobble = state.running ? Math.sin(t * chompRate * 0.5) * 3 : Math.sin(t * 2) * 1.5;
    ctx.save();
    ctx.translate(a.x - R * 0.55, a.y - 4 + wobble);
    drawMonsterShape(ctx, R, t, open, frenzy);
    ctx.restore();
  }

  function drawAvatar(t) {
    actx.clearRect(0, 0, 96, 72);
    const { open, frenzy } = mouthOpen(t);
    actx.save();
    actx.translate(44, 40 + Math.sin(t * 2) * 1.5);
    drawMonsterShape(actx, 26, t, open, frenzy);
    actx.restore();
  }

  function drawBubble() {
    if (!state.bubble || !state.lines.length) return;
    const a = monsterAnchor();
    const right = W - MM - SCROLLBAR_W;
    ctx.font = BUBBLE_FONT;
    ctx.textBaseline = 'middle';
    const text = state.bubble.text;
    const tw = ctx.measureText(text).width;
    const bw = tw + 24;
    const bh = 30;
    let bx = a.x - 20;
    if (bx + bw > right - 8) bx = right - 8 - bw;
    if (bx < 8) bx = 8;
    let by = a.y - 78 - bh;
    let tailUp = false;
    if (by < 6) { by = a.y + 44; tailUp = true; }
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    roundRect(bx, by, bw, bh, 6);
    ctx.fill();
    ctx.stroke();
    const tx = Math.max(bx + 14, Math.min(bx + bw - 14, a.x - 14));
    ctx.beginPath();
    if (tailUp) {
      ctx.moveTo(tx - 6, by); ctx.lineTo(tx + 2, by - 10); ctx.lineTo(tx + 8, by);
    } else {
      ctx.moveTo(tx - 6, by + bh); ctx.lineTo(tx + 2, by + bh + 10); ctx.lineTo(tx + 8, by + bh);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(tx - 5, tailUp ? by - 1 : by + bh - 1, 12, 3);
    ctx.fillStyle = '#111';
    ctx.textAlign = 'left';
    ctx.fillText(text, bx + 12, by + bh / 2 + 1);
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

  function drawFrenzyFlash() {
    if (performance.now() >= state.frenzyUntil) return;
    ctx.fillStyle = 'rgba(43, 125, 233, 0.08)';
    ctx.fillRect(0, 0, W, H);
  }

  // ---- Loop ---------------------------------------------------------------

  function frame(ts) {
    const dt = Math.min(0.05, (ts - (state.lastTs || ts)) / 1000);
    state.lastTs = ts;
    const t = ts / 1000;

    if (state.running) step(dt);

    const maxScroll = state.lines.length - ROWS + TOP_ROWS + 1.5;
    const target = Math.max(0, Math.min(state.li - 4, maxScroll));
    state.scroll += (Math.max(0, target) - state.scroll) * Math.min(1, dt * 6);

    if (!canvas.hidden) {
      drawEditor();
      drawMinimap();
      drawCrumbs(dt);
      drawMonster(t);
      drawBubble();
      drawFrenzyFlash();
    }
    drawAvatar(t);

    const line = state.lines[state.li];
    const pos = `Ln ${line ? line.rawLine + 1 : Math.max(1, state.lines.length)}, Col ${line ? line.eaten + 1 : 1}`;
    if (pos !== ui.lastPos) { stPos.textContent = pos; ui.lastPos = pos; }

    requestAnimationFrame(frame);
  }

  // ---- Files, tabs, views -------------------------------------------------

  function fileName(id) {
    if (id === 'readme') return 'README.md';
    return byId[id] ? byId[id].file : 'nothing';
  }

  function fileIcon(id) {
    if (id === 'readme') return '<span class="file-icon fi-md">i</span>';
    const s = byId[id];
    return `<span class="file-icon fi-${s.icon}">${s.icon.toUpperCase()}</span>`;
  }

  function renderFiles() {
    fileList.innerHTML = SNACKS.map((s) => {
      const cls = ['tree-item'];
      if (ui.activeId === s.id) cls.push('is-active');
      if (state.fileId === s.id && (state.running || state.paused)) cls.push('is-eating');
      if (ui.eaten.has(s.id)) cls.push('is-eaten');
      return `<li class="${cls.join(' ')}" role="treeitem" data-file="${s.id}"><span class="tree-row">${fileIcon(s.id)}${esc(s.file)}</span></li>`;
    }).join('');
    const readme = fileTree.querySelector('[data-file="readme"]');
    readme.classList.toggle('is-active', ui.activeId === 'readme');
  }

  function renderTabs() {
    tabsEl.innerHTML = ui.openTabs.map((id) => {
      const cls = ['tab'];
      if (ui.activeId === id) cls.push('is-active');
      if (state.fileId === id && (state.running || state.paused)) cls.push('is-dirty');
      return `<div class="${cls.join(' ')}" role="tab" data-tab="${id}">${fileIcon(id)}<span>${esc(fileName(id))}</span><span class="tab-close" data-close="${id}" title="Close"><i class="codicon codicon-close"></i></span></div>`;
    }).join('');
    const active = tabsEl.querySelector('.tab.is-active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function renderEditorView() {
    const id = ui.activeId;
    canvas.hidden = true;
    editorEmpty.hidden = true;
    editorText.hidden = true;
    editorReadme.hidden = true;
    overlay.hidden = true;
    if (!id) {
      editorEmpty.hidden = false;
      crumbFile.textContent = '';
    } else if (id === 'readme') {
      editorReadme.hidden = false;
      crumbFile.textContent = 'README.md';
    } else if (id === 'own' && state.fileId !== 'own') {
      editorText.hidden = false;
      updateTextGutter();
      crumbFile.textContent = 'my-code.txt';
    } else {
      canvas.hidden = false;
      overlay.hidden = ui.overlayHidden;
      crumbFile.textContent = fileName(id);
    }
    const snack = byId[id];
    stLang.textContent = id === 'readme' ? 'Markdown' : snack ? snack.lang : 'Plain Text';
  }

  function openFile(id, opts = {}) {
    if (!ui.openTabs.includes(id)) ui.openTabs.push(id);
    ui.activeId = id;
    const isSnack = !!byId[id];
    if (isSnack && id !== state.fileId) {
      if (state.running || state.paused) abortMeal();
      if (id === 'own') {
        unload();
      } else {
        loadFile(id);
      }
    } else if (id === 'own' && state.fileId === 'own' && state.done && opts.fromExplorer) {
      // back to the text editor so the user can paste something new
      unload();
    }
    if (isSnack && state.fileId === id && !state.running && !state.paused && !state.done) {
      showOverlay('ME WANT CODE', 'this one looks tasty.<br>press Feed Me, or hit Space', 'Feed Me');
    }
    renderTabs();
    renderFiles();
    renderEditorView();
    updateSearch();
    if (window.matchMedia('(max-width: 720px)').matches) workbench.classList.remove('sidebar-open-mobile');
  }

  function closeTab(id) {
    const i = ui.openTabs.indexOf(id);
    if (i < 0) return;
    ui.openTabs.splice(i, 1);
    if (ui.activeId === id) {
      if (state.fileId === id && (state.running || state.paused)) abortMeal();
      const next = ui.openTabs[i] || ui.openTabs[i - 1] || null;
      if (next) openFile(next);
      else {
        ui.activeId = null;
        renderTabs();
        renderFiles();
        renderEditorView();
      }
    } else {
      renderTabs();
    }
  }

  function loadFile(id) {
    const snack = byId[id];
    let source = snack.code;
    if (id === 'own') {
      source = input.value.trim() ? input.value : '// me see empty jar. me sad.\n// paste code and try again';
    }
    state.fileId = id;
    reset(source);
    ui.overlayHidden = false;
    startBtn.textContent = 'Feed Me';
    setMood();
  }

  // Empty the canvas without loading anything (used by the text editor view).
  function unload() {
    state.fileId = null;
    state.lines = [];
    state.source = '';
    state.done = false;
    state.stats = { lines: 0, chars: 0, bugs: 0, total: 0 };
    buildMinimap();
    renderProblems();
    updateStats();
    updateOutline();
    startBtn.textContent = 'Feed Me';
  }

  function abortMeal() {
    state.running = false;
    state.paused = false;
    state.done = false;
    startBtn.textContent = 'Feed Me';
    pendingLog.lines = 0;
    pendingLog.chars = 0;
    tlog(`<span class="t-err">^C</span>  <span class="t-nom">monster:</span> HEY. ME NOT DONE.`);
    newPrompt();
    setMood();
  }

  // ---- Feeding controls ---------------------------------------------------

  function feed() {
    if (state.running) { pause(); return; }
    if (state.paused) { resume(); return; }
    let id = ui.activeId;
    if (!id || id === 'readme') {
      id = DEFAULT_ID;
      openFile(id);
    }
    if (id === 'own' || state.fileId !== id || state.done) loadFile(id);
    start();
  }

  function start() {
    ensureAudio();
    if (audio && audio.state === 'suspended') audio.resume();
    state.running = true;
    state.paused = false;
    state.done = false;
    state.nextQuoteAt = performance.now() + 900;
    say('ME WANT CODE!', 1200);
    hideOverlay();
    startBtn.textContent = 'Stop';
    const name = fileName(state.fileId);
    tcmd(`monster feed ${name} --hunger ${speedInput.value}`);
    tlog(`<span class="t-dim">info</span> opening ${esc(name)} (${state.lines.length} lines, ${state.stats.total} chars). ${state.lines.filter((l) => l.bug).length} bugs detected. yum.`);
    outLog(`[Commit Monster] feeding ${name} at hunger ${speedInput.value}.`);
    addTimeline(`Fed ${name} to the monster`);
    renderTabs();
    renderFiles();
    renderEditorView();
    setMood();
  }

  function pause() {
    state.running = false;
    state.paused = true;
    showOverlay('ME TAKE BREAK', 'he will wait.<br>he will not wait long.', 'Resume');
    startBtn.textContent = 'Resume';
    tlog(`<span class="t-dim">paused</span> monster is waiting. impatiently.`);
    renderTabs();
    renderEditorView();
    setMood();
  }

  function resume() {
    state.running = true;
    state.paused = false;
    hideOverlay();
    startBtn.textContent = 'Stop';
    say('WHERE WAS ME', 1000);
    renderTabs();
    renderEditorView();
    setMood();
  }

  function frenzy() {
    if (!state.running) return;
    state.frenzyUntil = performance.now() + 1100;
    say(['MORE! MORE!', 'FASTER!', 'OM NOM NOM NOM NOM'][Math.floor(Math.random() * 3)], 900);
    state.nextQuoteAt = performance.now() + 2000;
    debugLog('monster.frenzy() // triggered by user. no regrets.');
    setMood();
  }

  function setHunger(delta) {
    const v = Math.max(1, Math.min(10, Number(speedInput.value) + delta));
    speedInput.value = v;
    syncHunger();
  }

  function syncHunger() {
    speedOut.textContent = speedInput.value;
    stHunger.textContent = `🍪 Hunger ${speedInput.value}`;
    wHunger.textContent = speedInput.value;
  }

  function setMood() {
    let text = 'Hungry';
    let icon = 'flame';
    if (state.running) { text = performance.now() < state.frenzyUntil ? 'FRENZY' : 'Eating'; icon = 'debug-start'; }
    else if (state.paused) { text = 'Paused'; icon = 'debug-pause'; }
    else if (state.done) { text = 'Full (for now)'; icon = 'check'; }
    stMood.innerHTML = `<i class="codicon codicon-${icon}"></i> ${text}`;
    statusbar.classList.toggle('is-eating', state.running || state.paused);
    statusbar.classList.toggle('is-full', !state.running && !state.paused && state.done);
    renderCallstack();
    updateStats();
  }

  function showOverlay(title, msg, btn) {
    overlayTitle.textContent = title;
    overlayMsg.innerHTML = msg;
    overlayStart.textContent = btn;
    ui.overlayHidden = false;
    renderEditorView();
  }

  function hideOverlay() {
    ui.overlayHidden = true;
    renderEditorView();
  }

  // ---- Terminal, output, problems, timeline, scm, debug ----------------------

  let promptEl = null;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function promptHtml() {
    return `<span class="t-prompt">monster@vscode</span> <span class="t-dim">~/snacks</span> $ `;
  }

  function newPrompt() {
    promptEl = document.createElement('div');
    promptEl.innerHTML = `${promptHtml()}<span class="t-caret"></span>`;
    terminalEl.appendChild(promptEl);
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }

  function tcmd(cmd) {
    if (!promptEl) newPrompt();
    promptEl.innerHTML = `${promptHtml()}${esc(cmd)}`;
    promptEl = null;
  }

  function tlog(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    if (promptEl) terminalEl.insertBefore(div, promptEl);
    else terminalEl.appendChild(div);
    while (terminalEl.children.length > 300) terminalEl.removeChild(terminalEl.firstChild);
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }

  function outLog(text) {
    outputEl.textContent += `\n${text}`;
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function debugLog(text) {
    debugConsoleEl.textContent += `\n${text}`;
  }

  function renderProblems() {
    const items = state.lines.map((l, i) => ({ l, i })).filter((x) => x.l.bug);
    const remaining = items.filter((x) => x.l.eaten < x.l.text.length).length;
    problemsBadge.textContent = remaining;
    problemsBadge.hidden = remaining === 0;
    stWarnings.textContent = remaining;
    if (!items.length || !state.fileId) {
      problemsEl.innerHTML = '<li class="p-empty">No problems have been detected in the workspace. He ate them.</li>';
      return;
    }
    const name = fileName(state.fileId);
    let html = `<li class="p-file"><i class="codicon codicon-chevron-down"></i>${fileIcon(state.fileId)}<span>${esc(name)}</span><span class="p-path">snacks</span><span class="badge-inline">${remaining}</span></li>`;
    for (const { l, i } of items) {
      const eaten = l.eaten >= l.text.length;
      const col = l.text.search(BUG_RE) + 1;
      html += `<li class="p-item${eaten ? ' is-eaten' : ''}" data-line="${i}"><i class="codicon codicon-${eaten ? 'check' : 'warning'}"></i><span>${esc(bugKind(l.text))}: ${esc(l.text.trim())}</span><span class="p-loc">[Ln ${l.rawLine + 1}, Col ${col}]</span></li>`;
    }
    problemsEl.innerHTML = html;
  }

  function markProblemEaten(i) {
    const l = state.lines[i];
    tlog(`<span class="t-warn">warning</span> ${esc(fileName(state.fileId))}:${l.rawLine + 1} ${esc(bugKind(l.text))}. eaten. resolved.`);
    renderProblems();
  }

  function addTimeline(text) {
    const li = document.createElement('li');
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    li.innerHTML = `<time>${hh}:${mm}</time><span>${esc(text)}</span>`;
    timelineEl.insertBefore(li, timelineEl.firstChild);
    while (timelineEl.children.length > 20) timelineEl.removeChild(timelineEl.lastChild);
  }

  function renderScm() {
    const ids = [...ui.eaten];
    scmCount.textContent = ids.length;
    scmBadge.textContent = ids.length;
    scmBadge.hidden = ids.length === 0;
    scmList.innerHTML = ids.length
      ? ids.map((id) => `<li class="tree-item"><span class="tree-row" style="color:#f14c4c">${fileIcon(id)}${esc(fileName(id))}<span style="margin-left:auto;padding-right:10px">D</span></span></li>`).join('')
      : '<li class="pane-empty" style="padding-left:20px">No changes. Feed him first.</li>';
  }

  function commit() {
    const n = ui.eaten.size;
    if (!n) {
      showToast('Nothing to commit. Feed the monster first.', { kind: 'warning' });
      return;
    }
    const msg = $('scm-message').value.trim() || 'feat: remove technical debt';
    tcmd(`git commit -am "${msg}"`);
    tlog(`<span class="t-dim">[main ${Math.random().toString(16).slice(2, 9)}]</span> ${esc(msg)}`);
    tlog(` ${n} file${n === 1 ? '' : 's'} changed, 0 insertions(+), ${state.stats.lines} deletions(-)`);
    newPrompt();
    addTimeline(`Committed "${msg}"`);
    showToast(`Committed <b>${esc(msg)}</b> to main. ${n} file${n === 1 ? '' : 's'} deleted. Code review skipped.`);
    ui.eaten.clear();
    $('scm-message').value = '';
    renderScm();
    renderFiles();
  }

  function renderCallstack() {
    if (!state.running && !state.paused) {
      callstack.innerHTML = '<li class="dim">Not eating</li>';
      return;
    }
    const name = fileName(state.fileId);
    const ln = state.lines[state.li] ? state.lines[state.li].rawLine + 1 : 0;
    callstack.innerHTML = [
      ['chomp', `${name}:${ln}`],
      ['eatLine', `${name}:${ln}`],
      ['CommitMonster.feed', 'monster.ts:42'],
      ['main', 'extension.ts:7'],
    ].map(([fn, loc], i) => `<li class="callstack-frame"><span class="${i ? 'w-name' : 'w-val'}">${fn}</span><span class="cs-loc">${esc(loc)}</span></li>`).join('');
  }

  // ---- Sidebar views, panel, layout ---------------------------------------

  const VIEW_TITLES = { explorer: 'Explorer', search: 'Search', scm: 'Source Control', debug: 'Run and Debug', extensions: 'Extensions' };

  function switchView(view) {
    ui.view = view;
    document.querySelectorAll('.activity[data-view]').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
    document.querySelectorAll('.sidebar-view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $('sidebar-title-text').textContent = VIEW_TITLES[view] || view;
    showSidebar(true);
    if (view === 'search') searchInput.focus();
  }

  function isMobile() {
    return window.matchMedia('(max-width: 720px)').matches;
  }

  function sidebarVisible() {
    return isMobile() ? workbench.classList.contains('sidebar-open-mobile') : !workbench.classList.contains('sidebar-hidden');
  }

  function showSidebar(show) {
    if (isMobile()) workbench.classList.toggle('sidebar-open-mobile', show);
    else workbench.classList.toggle('sidebar-hidden', !show);
  }

  function toggleSidebar() {
    showSidebar(!sidebarVisible());
  }

  function showPanel(tab) {
    panel.hidden = false;
    document.querySelectorAll('.panel-tab').forEach((b) => b.classList.toggle('is-active', b.dataset.panel === tab));
    document.querySelectorAll('.panel-body').forEach((b) => { b.hidden = b.dataset.panel !== tab; });
  }

  function togglePanel() {
    panel.hidden = !panel.hidden;
  }

  function updateTextGutter() {
    const n = Math.max(1, input.value.split('\n').length);
    let s = '';
    for (let i = 1; i <= n; i++) s += `${i}\n`;
    textGutter.textContent = s;
    textGutter.style.transform = `translateY(${-input.scrollTop}px)`;
  }

  function updateSearch() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.textContent = 'Type to search the current snack.'; return; }
    const snack = byId[ui.activeId];
    const src = ui.activeId === 'own' ? input.value : snack ? snack.code : '';
    const hits = [];
    src.split('\n').forEach((line, i) => {
      if (line.toLowerCase().includes(q)) hits.push(`<div style="padding:1px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="color:var(--fg-dim)">${i + 1}</span> ${esc(line.trim())}</div>`);
    });
    searchResults.innerHTML = hits.length
      ? `<div style="margin-bottom:4px">${hits.length} result${hits.length === 1 ? '' : 's'} in ${esc(fileName(ui.activeId))}</div>${hits.slice(0, 40).join('')}`
      : 'No results found. Maybe he ate it.';
  }

  // ---- Toasts -------------------------------------------------------------

  function showToast(html, opts = {}) {
    const el = document.createElement('div');
    el.className = 'toast';
    const actions = opts.actions || [];
    el.innerHTML = `<i class="codicon codicon-${opts.kind || 'info'}"></i><div class="toast-body">${html}${actions.length ? `<div class="toast-actions">${actions.map((a, i) => `<button type="button" class="btn ${i ? '' : 'btn-primary'}" data-action="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}</div><i class="codicon codicon-close toast-close" title="Clear notification"></i>`;
    el.querySelector('.toast-close').addEventListener('click', () => el.remove());
    el.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => { actions[Number(b.dataset.action)].run(); el.remove(); }));
    toastsEl.appendChild(el);
    while (toastsEl.children.length > 3) toastsEl.removeChild(toastsEl.firstChild);
    setTimeout(() => el.remove(), actions.length ? 15000 : 8000);
    return el;
  }

  function about() {
    showToast('<b>Commit Monster</b> 1.0.0. A furry blue monster eats a Visual Studio Code lookalike. The snacks are real excerpts from SQLite, Lua, Redis, curl, Go, CPython, React and Rust, each with its license in the header. No code was harmed. All of it was eaten.');
  }

  // ---- Command palette ----------------------------------------------------

  let paletteMode = 'all';
  let paletteIndex = 0;
  let paletteItems = [];

  function commands() {
    const list = [
      { label: 'Commit Monster: Feed Me', hint: 'Space', icon: 'flame', run: feed },
      { label: state.running ? 'Commit Monster: Stop Eating' : 'Commit Monster: Resume Eating', hint: 'Esc', icon: 'debug-pause', run: () => (state.running ? pause() : state.paused ? resume() : feed()) },
      { label: 'Commit Monster: Frenzy', hint: 'click editor', icon: 'zap', run: frenzy },
      { label: 'Commit Monster: Toggle Crunch Sounds', icon: 'unmute', run: () => { soundCheck.checked = !soundCheck.checked; } },
      { label: 'Commit Monster: Hunger Up', icon: 'arrow-up', run: () => setHunger(1) },
      { label: 'Commit Monster: Hunger Down', icon: 'arrow-down', run: () => setHunger(-1) },
      { label: 'Commit Monster: Feed Him My Own Code', icon: 'edit', run: () => openFile('own', { fromExplorer: true }) },
      { label: 'Git: Commit', icon: 'git-commit', run: () => { switchView('scm'); commit(); } },
      { label: 'View: Toggle Primary Side Bar', hint: '⌘B', icon: 'layout-sidebar-left', run: toggleSidebar },
      { label: 'View: Toggle Panel', hint: '⌘J', icon: 'layout-panel', run: togglePanel },
      { label: 'View: Toggle Terminal', hint: '⌃`', icon: 'terminal', run: () => (panel.hidden ? showPanel('terminal') : togglePanel()) },
      { label: 'View: Problems', icon: 'warning', run: () => showPanel('problems') },
      { label: 'View: Show Explorer', hint: '⇧⌘E', icon: 'files', run: () => switchView('explorer') },
      { label: 'View: Show Source Control', hint: '⌃⇧G', icon: 'source-control', run: () => switchView('scm') },
      { label: 'View: Show Run and Debug', hint: '⇧⌘D', icon: 'debug-alt', run: () => switchView('debug') },
      { label: 'View: Show Extensions', hint: '⇧⌘X', icon: 'extensions', run: () => switchView('extensions') },
      { label: 'Preferences: Color Theme', icon: 'color-mode', run: () => showToast('Dark+ (default dark). He only eats in the dark.') },
      { label: 'Help: About', icon: 'info', run: about },
      { label: 'Help: Open README', icon: 'book', run: () => openFile('readme') },
    ];
    for (const s of SNACKS) {
      list.push({ label: `snacks/${s.file}`, hint: s.lang, icon: 'file', file: true, run: () => openFile(s.id, { fromExplorer: true }) });
    }
    list.push({ label: 'README.md', hint: 'Markdown', icon: 'file', file: true, run: () => openFile('readme') });
    return list;
  }

  function openPalette(mode = 'all', query = '') {
    paletteMode = mode;
    paletteEl.hidden = false;
    paletteInput.value = query;
    paletteInput.placeholder = mode === 'files' ? 'Search snacks by name' : 'Type a command';
    paletteIndex = 0;
    renderPalette();
    paletteInput.focus();
  }

  function closePalette() {
    paletteEl.hidden = true;
  }

  function renderPalette() {
    const q = paletteInput.value.trim().toLowerCase();
    paletteItems = commands().filter((c) => (paletteMode === 'files' ? c.file : true) && (!q || c.label.toLowerCase().includes(q)));
    paletteIndex = Math.max(0, Math.min(paletteIndex, paletteItems.length - 1));
    paletteList.innerHTML = paletteItems.length
      ? paletteItems.map((c, i) => {
        let label = esc(c.label);
        if (q) {
          const at = c.label.toLowerCase().indexOf(q);
          label = `${esc(c.label.slice(0, at))}<b>${esc(c.label.slice(at, at + q.length))}</b>${esc(c.label.slice(at + q.length))}`;
        }
        return `<li class="${i === paletteIndex ? 'is-active' : ''}" data-index="${i}"><i class="codicon codicon-${c.icon}"></i><span>${label}</span>${c.hint ? `<span class="pl-hint">${esc(c.hint)}</span>` : ''}</li>`;
      }).join('')
      : '<li><span style="color:var(--fg-dim)">No matching commands. He ate them.</span></li>';
    const active = paletteList.querySelector('.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function runPalette(i) {
    const item = paletteItems[i];
    closePalette();
    if (item) item.run();
  }

  // ---- Events -------------------------------------------------------------

  startBtn.addEventListener('click', feed);
  overlayStart.addEventListener('click', feed);
  $('debug-run').addEventListener('click', () => { if (!state.running) feed(); });
  overlayLater.addEventListener('click', () => {
    hideOverlay();
    if (ui.activeId === 'own' && state.done) openFile('own', { fromExplorer: true });
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    frenzy();
  });

  speedInput.addEventListener('input', syncHunger);
  stHunger.addEventListener('click', () => { setHunger(Number(speedInput.value) >= 10 ? -9 : 1); });
  stMood.addEventListener('click', feed);
  $('st-errors').parentElement.addEventListener('click', () => showPanel('problems'));

  input.addEventListener('input', () => { updateTextGutter(); updateSearch(); });
  input.addEventListener('scroll', () => { textGutter.style.transform = `translateY(${-input.scrollTop}px)`; });

  fileTree.addEventListener('click', (e) => {
    const item = e.target.closest('[data-file]');
    if (item) { openFile(item.dataset.file, { fromExplorer: true }); return; }
    const folder = e.target.closest('.tree-folder');
    if (folder && e.target.closest('.tree-row')) folder.classList.toggle('is-open');
  });

  $('new-snack').addEventListener('click', (e) => { e.stopPropagation(); openFile('own', { fromExplorer: true }); input.focus(); });

  tabsEl.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close]');
    if (close) { closeTab(close.dataset.close); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) openFile(tab.dataset.tab);
  });
  tabsEl.addEventListener('auxclick', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab && e.button === 1) closeTab(tab.dataset.tab);
  });

  document.querySelectorAll('.pane-header').forEach((h) => {
    h.addEventListener('click', (e) => {
      if (e.target.closest('.pane-actions')) return;
      const pane = h.parentElement;
      pane.classList.toggle('is-open');
      h.querySelector('.codicon').className = `codicon codicon-chevron-${pane.classList.contains('is-open') ? 'down' : 'right'}`;
    });
  });

  document.querySelectorAll('.activity[data-view]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.view === ui.view && sidebarVisible()) showSidebar(false);
      else switchView(b.dataset.view);
    });
  });

  $('toggle-sidebar').addEventListener('click', toggleSidebar);
  $('toggle-panel').addEventListener('click', togglePanel);
  $('close-panel').addEventListener('click', () => { panel.hidden = true; });
  $('clear-terminal').addEventListener('click', () => { terminalEl.innerHTML = ''; promptEl = null; newPrompt(); });
  document.querySelectorAll('.panel-tab').forEach((b) => b.addEventListener('click', () => showPanel(b.dataset.panel)));

  $('open-palette').addEventListener('click', () => openPalette('all'));
  $('open-settings').addEventListener('click', () => showToast('Settings are for people who do not eat code.', {
    actions: [{ label: 'Open Snacks', run: () => switchView('explorer') }],
  }));
  $('scm-commit').addEventListener('click', commit);
  $('scm-message').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit(); });
  searchInput.addEventListener('input', updateSearch);
  document.querySelectorAll('.btn-tiny').forEach((b) => b.addEventListener('click', () => showToast('Extension installed. It was delicious.')));

  document.querySelectorAll('.menubar [data-menu]').forEach((b) => {
    b.addEventListener('click', () => {
      const m = b.dataset.menu;
      if (m === 'File') openPalette('files');
      else if (m === 'Help') about();
      else if (m === 'Terminal') showPanel('terminal');
      else if (m === 'Run') feed();
      else if (m === 'View') openPalette('all', 'View: ');
      else openPalette('all');
    });
  });

  paletteInput.addEventListener('input', () => { paletteIndex = 0; renderPalette(); });
  paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); paletteIndex = Math.min(paletteItems.length - 1, paletteIndex + 1); renderPalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); paletteIndex = Math.max(0, paletteIndex - 1); renderPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); runPalette(paletteIndex); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  });
  paletteList.addEventListener('click', (e) => {
    const li = e.target.closest('[data-index]');
    if (li) runPalette(Number(li.dataset.index));
  });
  paletteEl.addEventListener('mousedown', (e) => { if (e.target === paletteEl) closePalette(); });

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (!paletteEl.hidden) {
      if (e.key === 'Escape') closePalette();
      return;
    }
    if ((mod && e.shiftKey && key === 'p') || e.key === 'F1') { e.preventDefault(); openPalette('all'); return; }
    if (mod && !e.shiftKey && key === 'p') { e.preventDefault(); openPalette('files'); return; }
    if (mod && key === 'b') { e.preventDefault(); toggleSidebar(); return; }
    if (mod && (key === 'j' || e.key === '`')) { e.preventDefault(); togglePanel(); return; }
    if (mod && e.shiftKey && key === 'e') { e.preventDefault(); switchView('explorer'); return; }
    if (mod && e.shiftKey && key === 'x') { e.preventDefault(); switchView('extensions'); return; }
    if (mod && e.shiftKey && key === 'd') { e.preventDefault(); switchView('debug'); return; }
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === ' ' || (e.key === 'Enter' && tag !== 'BUTTON')) {
      e.preventDefault();
      if (state.running) frenzy();
      else feed();
    } else if (e.key === 'Escape' && state.running) {
      pause();
    }
  });

  if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe(editorEl);
  else window.addEventListener('resize', fitCanvas);

  // ---- Boot ---------------------------------------------------------------

  function boot() {
    fitAvatar();
    fitCanvas();
    syncHunger();
    newPrompt();
    renderScm();
    if (DEFAULT_ID) {
      openFile(DEFAULT_ID);
      showOverlay('ME WANT CODE', 'pick a snack from the explorer, or paste your own<br>click the editor while he eats to make him frantic', 'Feed Me');
    } else {
      renderTabs();
      renderFiles();
      renderEditorView();
    }
    setMood();
    requestAnimationFrame(frame);
  }

  // Small console API for people who like to poke things: CommitMonster.feed()
  window.CommitMonster = {
    feed, pause, resume, frenzy, openFile, commit,
    tick: (seconds = 1) => { if (state.running) step(seconds); },
    get state() { return state; },
  };

  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load(FONT), document.fonts.load(BUBBLE_FONT)]).then(boot, boot);
  } else {
    boot();
  }
})();
