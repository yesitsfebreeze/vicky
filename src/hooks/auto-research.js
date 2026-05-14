#!/usr/bin/env node
/**
 * Auto-research hook
 * Runs on each user prompt submit
 * Checks for pending research and triggers processing
 */

import { existsSync, readdirSync } from 'fs';
import * as fs from '../fs.js';

// Check if there are pending research items
function hasPending() {
	const dir = fs.pending();
	if (!existsSync(dir)) return false;
	return readdirSync(dir).length > 0;
}

// Notify Claude Code to process pending research
function notify() {
	console.log(JSON.stringify({
		status: 'info',
		message: 'Vicky: Pending research detected. Running auto-research...'
	}));
}

if (hasPending()) {
	notify();
}

export { hasPending };
