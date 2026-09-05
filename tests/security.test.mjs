import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, readdir, rename, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import vm from 'node:vm';
import { buildSite, PUBLIC_FILES } from '../scripts/build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const app = await readFile(join(root, 'js/app.js'), 'utf8');
const snacks = await readFile(join(root, 'js/snacks.js'), 'utf8');
const html = await readFile(join(root, 'index.html'), 'utf8');
const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));

// Exercise the actual application and event handlers in a small DOM harness.
// This verifies text reaching HTML sinks, not a browser's CSP enforcement.
function harness() {
  const htmlWrites = [];
  class Element {
    constructor() {
      this.value = '';
      this.textContent = '';
      this.children = [];
      this.hidden = true;
      this.checked = false;
      this.scrollTop = 0;
      this.scrollHeight = 0;
      this.style = {};
      this.dataset = {};
      this.parentElement = this;
      this.events = new Map();
      this.queries = new Map();
      this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    }
    set innerHTML(value) { this.html = value; htmlWrites.push(value); }
    get innerHTML() { return this.html || ''; }
    get firstChild() { return this.children[0]; }
    get lastChild() { return this.children.at(-1); }
    appendChild(el) { this.children.push(el); return el; }
    insertBefore(el, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, el); }
    removeChild(el) { this.children.splice(this.children.indexOf(el), 1); }
    remove() {}
    addEventListener(name, fn) { this.events.set(name, fn); }
    querySelector(selector) {
      if (!this.queries.has(selector)) this.queries.set(selector, new Element());
      return this.queries.get(selector);
    }
    querySelectorAll() { return []; }
    scrollIntoView() {}
    focus() {}
    getBoundingClientRect() { return { width: 640, height: 420 }; }
    getContext() { return new Proxy({}, { get: (_, name) => name === 'measureText' ? () => ({ width: 8.4 }) : () => {} }); }
  }
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  get('cm-speed').value = '5';
  const context = vm.createContext({
    document: {
      getElementById: get,
      querySelector: get,
      querySelectorAll: () => [],
      createElement: () => new Element(),
      addEventListener() {},
    },
    window: { devicePixelRatio: 1, matchMedia: () => ({ matches: false }), addEventListener() {} },
    performance,
    requestAnimationFrame() {},
    setTimeout() {},
  });
  vm.runInContext(snacks, context, { timeout: 1000 });
  vm.runInContext(app, context, { timeout: 1000 });
  return {
    get, htmlWrites,
    api: context.window.CommitMonster,
    run: (code) => vm.runInContext(code, context, { timeout: 1500 }),
  };
}

test('pasted HTML and commit messages remain escaped through search, problems and terminal', () => {
  const h = harness();
  const payload = '// TODO <img src=x onerror=alert(1)>\n// TODO <svg/onload=alert(1)>';
  h.api.openFile('own');
  h.get('cm-input').value = payload;
  h.get('search-input').value = 'todo';
  h.get('search-input').events.get('input')();
  assert.match(h.get('search-results').innerHTML, /&lt;img/);
  h.run('window.CommitMonster.feed()');
  assert.equal(h.api.state.source, payload);
  assert.match(h.get('problems').innerHTML, /&lt;img/);
  h.run('window.CommitMonster.tick(10000); window.CommitMonster.tick(1)');
  assert.equal(h.api.state.done, true);
  h.get('scm-message').value = payload;
  h.api.commit();
  assert.ok(h.htmlWrites.some((value) => value.includes('&lt;img')));
  assert.ok(h.htmlWrites.every((value) => !value.includes('<img') && !value.includes('<svg')));
});

test('oversized single lines and tabs cannot bypass the source or row limits', () => {
  for (const payload of ['x'.repeat(250000), '\t'.repeat(60000), 'function ' + 'a'.repeat(50000)]) {
    const h = harness();
    h.api.openFile('own');
    h.get('cm-input').value = payload;
    h.run('window.CommitMonster.feed()');
    assert.ok(h.get('cm-input').value.length <= 50000);
    assert.ok(h.api.state.source.length <= 50000);
    assert.ok(h.api.state.lines.length <= 600);
    assert.ok(h.api.state.lines.length > 0);
  }
});

test('oversized edits are bounded before updating search and the line gutter', () => {
  const h = harness();
  h.api.openFile('own');
  h.get('cm-input').value = 'TODO <script>alert(1)</script>\n'.repeat(10000);
  h.get('search-input').value = 'TODO';
  h.get('cm-input').events.get('input')();
  assert.equal(h.get('cm-input').value.length, 50000);
  assert.equal((h.get('search-results').innerHTML.match(/class="search-hit"/g) || []).length, 40);
  assert.ok(!h.get('search-results').innerHTML.includes('<script>'));
});

test('file selection rejects unknown and inherited object keys', () => {
  const h = harness();
  const original = h.api.state.fileId;
  for (const id of ['__proto__', 'constructor', 'toString', 'not-a-snack', '<img src=x>', null, {}]) h.api.openFile(id);
  assert.equal(h.api.state.fileId, original);
});

test('all bundled snacks still finish normally and clear their tech debt', () => {
  const h = harness();
  for (const id of ['sqlite', 'lua', 'redis', 'curl', 'go', 'python', 'react', 'rust']) {
    h.api.openFile(id);
    h.run('window.CommitMonster.feed(); window.CommitMonster.tick(100000); window.CommitMonster.tick(1)');
    assert.equal(h.api.state.done, true, id);
    assert.equal(h.api.state.stats.chars, h.api.state.stats.total, id);
    assert.equal(h.get('cm-debt').textContent, '0%', id);
  }
});

test('browser policy blocks external resources, inline code, framing and network APIs', async () => {
  const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
  const csp = headers['Content-Security-Policy'];
  for (const directive of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "connect-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'"]) {
    assert.ok(csp.split('; ').includes(directive), directive);
  }
  assert.ok(!/unsafe-|https?:|\*/.test(csp));
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  const fallback = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.equal(fallback, csp.replace("; frame-ancestors 'none'; upgrade-insecure-requests", ''));
  assert.ok(!/\s(?:style|on\w+)\s*=/.test(html));
  assert.ok(!/style=["']/.test(app));
  assert.ok(!/<(?:script|link)\b[^>]*(?:src|href)=["']https?:/.test(html));
  assert.ok(!/\b(?:eval|fetch|WebSocket|XMLHttpRequest)\s*\(|new\s+Function\s*\(/.test(app));
  for (const file of ['css/style.css', 'vendor/codicons/codicon.css']) {
    const css = await readFile(join(root, file), 'utf8');
    assert.ok(!/@import|url\(\s*["']?https?:/.test(css), file);
  }
});

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'commitmonster-security-'));
  for (const file of PUBLIC_FILES) {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await writeFile(join(dir, file), await readFile(join(root, file)));
  }
  return dir;
}

async function fileList(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await fileList(dir, path));
    else result.push(path);
  }
  return result.sort();
}

test('deployment contains only approved assets even with secrets and legacy output in the root', async () => {
  const dir = await fixture();
  await writeFile(join(dir, '.env'), 'TEST_ONLY_SECRET=must-not-publish');
  await mkdir(join(dir, 'dist/server'), { recursive: true });
  await writeFile(join(dir, 'dist/server/index.js'), 'legacy server');
  await mkdir(join(dir, '.git'));
  await writeFile(join(dir, '.git/config'), 'private repository configuration');
  const output = await buildSite(dir);
  assert.deepEqual(await fileList(output), [...PUBLIC_FILES].sort());
  await buildSite(dir);
  for (const file of PUBLIC_FILES) assert.deepEqual(await readFile(join(output, file)), await readFile(join(root, file)));
  assert.equal(config.outputDirectory, 'site');
  assert.equal(config.buildCommand, 'node scripts/build.mjs');
  assert.equal(config.installCommand, '');
  assert.equal(config.public, false);
});

test('packaging rejects unexpected output files without deleting them', async () => {
  const dir = await fixture();
  await mkdir(join(dir, 'site'));
  await writeFile(join(dir, 'site/leaked.env'), 'TEST_ONLY_SECRET');
  await assert.rejects(buildSite(dir), /Unexpected file/);
  assert.equal(await readFile(join(dir, 'site/leaked.env'), 'utf8'), 'TEST_ONLY_SECRET');
});

test('packaging rejects symbolic links in source and output', async () => {
  const source = await fixture();
  await rename(join(source, 'index.html'), join(source, 'private.html'));
  await symlink(join(source, 'private.html'), join(source, 'index.html'));
  await assert.rejects(buildSite(source), /Not a regular public file/);
  const outputRoot = await fixture();
  await symlink(join(outputRoot, 'js'), join(outputRoot, 'site'));
  await assert.rejects(buildSite(outputRoot), /Not a real directory/);
  const output = await fixture();
  await mkdir(join(output, 'site'));
  await symlink(join(output, 'index.html'), join(output, 'site/index.html'));
  await assert.rejects(buildSite(output), /Unexpected file/);
});
