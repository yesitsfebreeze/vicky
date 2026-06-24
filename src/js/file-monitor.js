import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import * as fs from './fs.js';
import { relink_dir } from './link.js';
import * as jobs from './jobs.js';

/**
 * File monitor for dependent files (graph.json, .graphify/, sources/, pending/).
 * Watches for changes and auto-triggers dependent operations without periodic checks.
 *
 * Architecture:
 * - graph.json changed → trigger relink
 * - sources/ changed → trigger relink + update_kb
 * - pending/ changed → trigger learn
 * - .graphify/ changed → trigger learn (re-analyze importance)
 */

const WATCH_FILES = [
	'.graphify/graph.json',        // Main semantic graph
	'.graphify/.graphify_ast.json', // AST for importance analysis
	'.graphify/manifest.json',      // File manifest
];

const WATCH_DIRS = [
	'pending',   // Research queue
	'sources',   // Source notes
];

class FileMonitor {
	constructor(notify) {
		this.notify = notify;
		this.fileStates = new Map();
		this.dirStates = new Map();
		this.pendingActions = new Set();
		this.initialized = false;
	}

	initialize() {
		if (this.initialized) return;
		this.initialized = true;

		// Capture initial state
		for (const file of WATCH_FILES) {
			const path = join(fs.root(), file);
			if (existsSync(path)) {
				try {
					const stat = statSync(path);
					this.fileStates.set(file, { mtime: stat.mtime, size: stat.size });
				} catch (e) {
					// Ignore stat errors
				}
			}
		}

		for (const dir of WATCH_DIRS) {
			const path = join(fs.root(), dir);
			if (existsSync(path)) {
				try {
					const files = readdirSync(path).filter(f => f.endsWith('.md')).length;
					this.dirStates.set(dir, { count: files, mtime: statSync(path).mtime });
				} catch (e) {
					// Ignore dir errors
				}
			}
		}
	}

	check() {
		if (!this.initialized) this.initialize();

		const changed = [];

		// Check watched files
		for (const file of WATCH_FILES) {
			const path = join(fs.root(), file);
			const exists = existsSync(path);
			const oldState = this.fileStates.get(file);

			if (exists) {
				try {
					const stat = statSync(path);
					const newState = { mtime: stat.mtime, size: stat.size };

					if (!oldState) {
						changed.push({ type: 'file_created', file });
						this.fileStates.set(file, newState);
					} else if (oldState.mtime < newState.mtime || oldState.size !== newState.size) {
						changed.push({ type: 'file_changed', file });
						this.fileStates.set(file, newState);
					}
				} catch (e) {
					// Ignore stat errors
				}
			} else if (oldState) {
				changed.push({ type: 'file_deleted', file });
				this.fileStates.delete(file);
			}
		}

		// Check watched directories
		for (const dir of WATCH_DIRS) {
			const path = join(fs.root(), dir);
			const exists = existsSync(path);
			const oldState = this.dirStates.get(dir);

			if (exists) {
				try {
					const stat = statSync(path);
					const files = readdirSync(path).filter(f => f.endsWith('.md')).length;
					const newState = { count: files, mtime: stat.mtime };

					if (!oldState) {
						changed.push({ type: 'dir_created', dir, count: files });
						this.dirStates.set(dir, newState);
					} else if (oldState.count !== newState.count || oldState.mtime < newState.mtime) {
						changed.push({ type: 'dir_changed', dir, count: files, oldCount: oldState.count });
						this.dirStates.set(dir, newState);
					}
				} catch (e) {
					// Ignore dir errors
				}
			} else if (oldState) {
				changed.push({ type: 'dir_deleted', dir });
				this.dirStates.delete(dir);
			}
		}

		return changed;
	}

	async react(changes) {
		if (changes.length === 0) return;

		for (const change of changes) {
			const actionKey = `${change.type}:${change.file || change.dir}`;
			if (this.pendingActions.has(actionKey)) continue; // Already scheduled

			this.pendingActions.add(actionKey);

			// Debounce: wait 500ms to batch related changes
			setTimeout(() => {
				this.pendingActions.delete(actionKey);
				this._triggerAction(change);
			}, 500);
		}
	}

	_triggerAction(change) {
		const { type, file, dir } = change;

		if (type === 'file_changed') {
			if (file.includes('graph.json')) {
				// Graph changed: relink everything
				this._scheduleRelink();
			} else if (file.includes('_ast.json')) {
				// AST changed: re-analyze importance + learn
				this._scheduleLean();
			} else if (file.includes('manifest.json')) {
				// Manifest changed: relink
				this._scheduleRelink();
			}
		} else if (type === 'dir_changed') {
			if (dir === 'pending') {
				// Pending queue grew: trigger learn
				this._scheduleLearn();
			} else if (dir === 'sources') {
				// Sources changed: relink + update graph
				this._scheduleRelink();
			}
		} else if (type === 'file_created') {
			if (file.includes('graph.json')) {
				this._scheduleRelink();
			}
		} else if (type === 'dir_created') {
			if (dir === 'pending') {
				this._scheduleLearn();
			}
		}
	}

	_scheduleRelink() {
		if (jobs.reject_if_running('relink')) return; // Already running
		if (this.notify) {
			this.notify('info', 'vicky: detected graph change, auto-relinking...');
		}
		// Trigger relink asynchronously (job system handles it)
		jobs.create('auto-relink');
	}

	_scheduleLearn() {
		if (jobs.reject_if_running('learn')) return; // Already running
		if (this.notify) {
			this.notify('info', 'vicky: pending queue changed, auto-learning...');
		}
		// Trigger learn asynchronously
		jobs.create('auto-learn');
	}
}

export { FileMonitor };

/**
 * Start background monitoring (optional, runs every 10s).
 * Call from mcp-server or a background service.
 */
export function startMonitoring(notify, intervalMs = 10000) {
	const monitor = new FileMonitor(notify);
	monitor.initialize();

	const loop = () => {
		try {
			const changes = monitor.check();
			if (changes.length > 0) {
				monitor.react(changes);
			}
		} catch (e) {
			// Silently ignore monitor errors
		}
	};

	const interval = setInterval(loop, intervalMs);
	return { stop: () => clearInterval(interval), monitor };
}

export default FileMonitor;
