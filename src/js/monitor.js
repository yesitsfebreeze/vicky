import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as fs from './paths.js';
import { analyzeFileImportance, coverageReport } from './graph-importance.js';

/**
 * Real-time monitor for progressive KB building.
 * Shows tier status, recent indexing, and recommendations.
 */

export async function runMonitor(updateInterval = 5000) {
	console.clear();

	async function updateDisplay() {
		console.clear();
		console.log('🔍 Vicky KB Building Monitor\n');
		console.log(`Workspace: ${fs.root()}`);
		console.log(`Updated: ${new Date().toLocaleTimeString()}\n`);

		try {
			// Get coverage
			const coverage = await coverageReport(50);

			if (!coverage.ok) {
				console.log('⚠️  No AST available. Run graphify first:\n');
				console.log('  node vicky graph-importance 0 30\n');
				return;
			}

			// Display tier progress
			console.log('📊 Tier Progress:\n');
			let nextIncomplete = null;
			for (const tier of coverage.tiers) {
				const bar = '█'.repeat(Math.floor(tier.coverage / 5)) + '░'.repeat(20 - Math.floor(tier.coverage / 5));
				const status = tier.coverage === 100 ? '✓' : tier.indexed > 0 ? '⊙' : '○';
				console.log(`  ${status} Tier ${tier.tier}: [${bar}] ${tier.indexed}/${tier.total} (${tier.coverage}%)`);
				if (!nextIncomplete && tier.coverage < 100) {
					nextIncomplete = tier.tier;
				}
			}

			console.log();
			const totalCoverage = Math.round((coverage.total_indexed / coverage.total_files) * 100);
			console.log(`📈 Overall: ${coverage.total_indexed}/${coverage.total_files} (${totalCoverage}%) indexed\n`);

			// Show recommendation
			if (nextIncomplete !== null) {
				const tier = coverage.tiers[nextIncomplete];
				const remaining = tier.total - tier.indexed;
				console.log(`💡 Next: Index tier ${nextIncomplete} (${remaining} files remaining)`);
				console.log(`   Run: vicky graph-importance ${nextIncomplete} 20\n`);
			} else {
				console.log('🎉 All tiers indexed!\n');
			}

			// Show recent sources
			try {
				const sourceDir = fs.sources();
				if (existsSync(sourceDir)) {
					const files = readdirSync(sourceDir)
						.filter(f => f.endsWith('.md'))
						.map(f => {
							const stat = require('fs').statSync(join(sourceDir, f));
							return { file: f, mtime: stat.mtime };
						})
						.sort((a, b) => b.mtime - a.mtime)
						.slice(0, 5);

					if (files.length > 0) {
						console.log('📝 Recently indexed:\n');
						for (const f of files) {
							const ago = Math.round((Date.now() - f.mtime.getTime()) / 1000);
							const timeStr = ago < 60 ? `${ago}s` : ago < 3600 ? `${Math.floor(ago/60)}m` : `${Math.floor(ago/3600)}h`;
							console.log(`   • ${f.file.substring(0, 40)} (${timeStr} ago)`);
						}
						console.log();
					}
				}
			} catch (e) {
				// Ignore source scan errors
			}

			console.log('Press Ctrl+C to stop monitoring.\n');

		} catch (e) {
			console.error(`Error: ${e.message}`);
		}
	}

	// Initial display
	await updateDisplay();

	// Update periodically
	const interval = setInterval(updateDisplay, updateInterval);

	// Handle SIGINT gracefully
	process.on('SIGINT', () => {
		clearInterval(interval);
		console.log('\n\nMonitor stopped.\n');
		process.exit(0);
	});
}

export default runMonitor;
