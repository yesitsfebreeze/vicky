import { build } from 'esbuild';
import { rmSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SRC = dirname(fileURLToPath(import.meta.url));
const DIST = join(SRC, '..', '..', 'dist');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// Bundle the single entry (main.js) into dist/vicky.js — the file plugin.json
// launches as the MCP server. The banner provides a CommonJS `require` shim so
// bundled deps that call require() work under ESM.
await build({
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'node18',
	entryPoints: [join(SRC, 'main.js')],
	outfile: join(DIST, 'vicky.js'),
	banner: { js: 'import { createRequire as __vCR } from "module"; const require = __vCR(import.meta.url);' },
	logLevel: 'info',
});
console.log('✓ Bundled main.js → dist/vicky.js');
