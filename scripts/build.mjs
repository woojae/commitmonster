// Static packaging only: no package installation, bundler, or server runtime.
import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_FILES = Object.freeze([
  'index.html',
  'css/style.css',
  'js/snacks.js',
  'js/app.js',
  'vendor/codicons/codicon.css',
  'vendor/codicons/codicon.ttf',
  'vendor/codicons/LICENSE',
  'vendor/codicons/LICENSE-CODE',
  'vendor/press-start-2p/press-start-2p.ttf',
  'vendor/press-start-2p/OFL.txt',
  'vendor/README.md',
]);

export async function buildSite(root) {
  const output = join(root, 'site');
  const directories = new Set(['.']);
  for (const file of PUBLIC_FILES) {
    for (let dir = dirname(file); dir !== '.'; dir = dirname(dir)) directories.add(dir);
  }

  // Reject symlinks in both source and output instead of following them to
  // files outside the public allowlist. Never delete unexpected user files.
  async function assertDirectory(path) {
    if (!(await lstat(path)).isDirectory()) throw new Error(`Not a real directory: ${path}`);
  }
  for (const dir of directories) await assertDirectory(join(root, dir));
  for (const file of PUBLIC_FILES) {
    if (!(await lstat(join(root, file))).isFile()) throw new Error(`Not a regular public file: ${file}`);
  }

  await mkdir(output, { recursive: true });
  await assertDirectory(output);
  async function checkOutput(dir = '.') {
    for (const entry of await readdir(join(output, dir), { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory() && directories.has(path)) await checkOutput(path);
      else if (!entry.isFile() || !PUBLIC_FILES.includes(path)) {
        throw new Error(`Unexpected file in site/: ${path}. Move it out before publishing.`);
      }
    }
  }
  await checkOutput();
  for (const file of PUBLIC_FILES) {
    await mkdir(dirname(join(output, file)), { recursive: true });
    await copyFile(join(root, file), join(output, file));
  }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  await buildSite(root);
  console.log(`Packaged ${PUBLIC_FILES.length} public files into site/.`);
}
