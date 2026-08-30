/**
 * Fold the demo build into one self-contained HTML file.
 *
 * `vite build --config vite.config.demo.ts` leaves an HTML shell pointing at a
 * JS file. That is fine on a web server and useless as a thing you can email,
 * drop on a USB stick, or publish somewhere that accepts a single page. This
 * inlines the script and any stylesheet so the result opens straight from the
 * filesystem with nothing else present.
 *
 *   node scripts/build-demo.mjs                     → apps/web/dist-demo/demo.html
 *   node scripts/build-demo.mjs --fragment out.html → the same page without
 *       <html>/<head>/<body>, for hosts that supply their own skeleton.
 *
 * Run the vite build first; this only rewrites its output.
 *
 * The shell is parsed BEFORE anything is inlined, deliberately. Once a megabyte
 * of application code is sitting in the document, `</head>` and `</body>` both
 * appear inside it — the print-preview builder writes a whole document into a
 * template string — and any regex over the assembled file silently truncates at
 * the first one it meets.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Relative to this file, not to the shell's cwd: `npm run demo` runs the vite
// half from apps/web, and half the time you are already in there when you
// re-run this by hand.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'apps/web/dist-demo');
const shellPath = path.join(DIR, 'standalone.html');

if (!existsSync(shellPath)) {
  console.error(
    'No build found at apps/web/dist-demo. Run this first, from apps/web:\n' +
      '  npx vite build --config vite.config.demo.ts',
  );
  process.exit(1);
}

const shell = readFileSync(shellPath, 'utf8');
const grab = (re) => (shell.match(re)?.[1] ?? '').trim();

const title = grab(/<title>([\s\S]*?)<\/title>/i) || 'Demo';
const bodyMarkup = grab(/<body>([\s\S]*?)<\/body>/i);

const read = (file) => {
  const p = path.join(DIR, file);
  if (!existsSync(p)) throw new Error(`${shellPath} references ${file}, which the build did not emit.`);
  return readFileSync(p, 'utf8');
};

const styles = [...shell.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="\/([^"]+)"/gi)].map((m) =>
  read(m[1]),
);
const scripts = [...shell.matchAll(/<script[^>]*src="\/([^"]+)"[^>]*><\/script>/gi)].map((m) =>
  // A closing tag inside a string literal would end the script element early.
  read(m[1]).replace(/<\/script/gi, '<\\/script'),
);

if (!scripts.length) {
  console.error('The shell references no script. Nothing to inline.');
  process.exit(1);
}

const head =
  `<title>${title}</title>\n` +
  styles.map((css) => `<style>\n${css}\n</style>`).join('\n') +
  (styles.length ? '\n' : '');

const tail = scripts.map((js) => `<script type="module">\n${js}\n</script>`).join('\n');

const mb = (s) => `${(Buffer.byteLength(s) / 1048576).toFixed(2)} MB`;

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
${head}</head>
<body>
${bodyMarkup}
${tail}
</body>
</html>
`;

const out = path.join(DIR, 'demo.html');
writeFileSync(out, full);
console.log(`${out}  ${mb(full)}`);

const i = process.argv.indexOf('--fragment');
if (i !== -1 && process.argv[i + 1]) {
  const frag = `${head}${bodyMarkup}\n${tail}\n`;
  writeFileSync(process.argv[i + 1], frag);
  console.log(`${process.argv[i + 1]}  ${mb(frag)}`);
}
