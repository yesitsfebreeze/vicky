import { build } from 'esbuild';
import { rmSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SRC = dirname(fileURLToPath(import.meta.url));
const DIST = join(SRC, '..', '..', 'dist');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// Try bundling as CommonJS to avoid ESM scope issues
try {
	await build({
		bundle: true,
		platform: 'node',
		format: 'cjs',
		target: 'node18',
		entryPoints: [join(SRC, 'main.js')],
		outfile: join(DIST, 'vicky.js'),
		logLevel: 'info',
	});
	console.log('✓ Built with CommonJS format');
} catch (e) {
	console.error('CommonJS build failed, trying ESM:', e.message);
	// Fallback to ESM
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
}
