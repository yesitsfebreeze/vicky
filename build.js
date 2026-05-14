import { build } from 'esbuild';
import { rmSync, mkdirSync } from 'fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');

const common = {
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'node18',
	external: ['graphifyy'],
	banner: { js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);' },
	logLevel: 'info',
};

await Promise.all([
	build({ ...common, entryPoints: ['src/index.js'],     outfile: 'dist/index.js' }),
	build({ ...common, entryPoints: ['src/init.js'],      outfile: 'dist/init.js' }),
	build({ ...common, entryPoints: ['src/dashboard.js'], outfile: 'dist/dashboard.js' }),
]);
