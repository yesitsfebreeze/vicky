/**
 * fs-wrapper.js — consolidated Node.js fs module exports
 *
 * All modules import from here to avoid bundler creating multiple
 * aliased imports of the fs module. This keeps writeFileSync, etc.
 * in a single unified scope.
 */

import {
	existsSync,
	readFileSync,
	writeFileSync,
	readdirSync,
	mkdirSync,
	unlinkSync,
	renameSync,
	statSync,
	copyFileSync,
	cpSync,
	rmSync,
} from 'fs';

export {
	existsSync,
	readFileSync,
	writeFileSync,
	readdirSync,
	mkdirSync,
	unlinkSync,
	renameSync,
	statSync,
	copyFileSync,
	cpSync,
	rmSync,
};
