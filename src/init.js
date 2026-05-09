import { mkdirSync, existsSync } from 'fs';
import { SRC, CON, RES, SRC_GRAPH, CON_GRAPH } from './conf.js';
import { update_src, update_con } from './graph.js';

export async function ensure_init() {
	mkdirSync(SRC, { recursive: true });
	mkdirSync(CON, { recursive: true });
	mkdirSync(RES, { recursive: true });

	const tasks = [];
	if (!existsSync(SRC_GRAPH)) {
		const task = update_src();
		if (task) tasks.push(task);
	}
	if (!existsSync(CON_GRAPH)) {
		const task = update_con();
		if (task) tasks.push(task);
	}
	if (tasks.length) await Promise.all(tasks);
}
