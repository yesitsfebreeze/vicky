import { build } from 'esbuild';
import { rmSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SRC = dirname(fileURLToPath(import.meta.url));
const DIST = join(SRC, '..', '..', 'dist');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

await build({
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'node18',
	entryPoints: [join(SRC, 'main.js')],
	outfile: join(DIST, 'vicky.js'),
	banner: { js: 'import { createRequire as __vCR } from "module"; const require = __vCR(import.meta.url);' },
	external: ['fs', 'path', 'child_process'],
	logLevel: 'info',
});
