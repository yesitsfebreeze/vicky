import { build } from 'esbuild';
import { rmSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SRC = dirname(fileURLToPath(import.meta.url));
const DIST = join(SRC, '..', '..', 'dist');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// Fallback to bundling with better error handling
import { readdirSync } from 'fs';

function findAllJs(dir, prefix = '') {
	const files = [];
	for (const f of readdirSync(dir, { withFileTypes: true })) {
		if (f.name.startsWith('.') || f.name.startsWith('_') || f.name.endsWith('.bak') || f.name === 'build.js') continue;
		const path = join(dir, f.name);
		if (f.isDirectory()) {
			files.push(...findAllJs(path, prefix + f.name + '/'));
		} else if (f.name.endsWith('.js')) {
			files.push(path);
		}
	}
	return files;
}

const jsFiles = findAllJs(SRC);

// Use unbundled approach: just copy and transpile without bundling
await build({
	bundle: false,
	platform: 'node',
	format: 'esm',
	target: 'node18',
	entryPoints: jsFiles,
	outdir: DIST,
	outbase: SRC,
	logLevel: 'info',
});
console.log(`✓ Transpiled ${jsFiles.length} files`);
