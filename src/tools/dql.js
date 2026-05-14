import { z } from 'zod';
import { run_dql } from '../dashboard.js';
import { ensure_init } from '../init.js';

const DOCS = `DQL = Dataview Query Language. Reference: https://blacksmithgu.github.io/obsidian-dataview/queries/structure/

Forms:
  LIST [<expr>] FROM <source> [WHERE …] [SORT …] [LIMIT n]
  TABLE [WITHOUT ID] col1 AS "Header", col2 … FROM <source> …
  TASK FROM <source> …
  CALENDAR <date-field> FROM <source>

Sources:
  "folder"        — pages in folder
  "a" OR "b"      — union
  "a" AND -"b"    — intersection minus
  #tag            — by tag
  [[Note]]        — outlinks of Note

Useful fields:
  file.link, file.name, file.folder, file.path
  file.inlinks, file.outlinks (length(…) for count)
  file.ctime, file.mtime, file.size
  <any frontmatter key>: type, date, tags, priority, status

Functions:
  length(list), choice(cond,a,b), contains(list,val), date(today),
  dur("14 days"), regexmatch(pat,str), lower(s), startswith(s,prefix)

Examples:
  TABLE WITHOUT ID file.link AS Node, length(file.inlinks) AS Inlinks
  FROM "conclusions"
  WHERE length(file.inlinks) > 0
  SORT length(file.inlinks) DESC LIMIT 20

  LIST FROM "sources" WHERE contains(tags, "perf")

  TABLE date, priority FROM "pending"
  WHERE status = "pending"
  SORT choice(priority = "high", 0, 1) ASC`;

export function register(server) {
	server.registerTool('dql', {
		description: 'Run a Dataview Query Language (DQL) query against the .vicky vault via Obsidian. Vault must be open in Obsidian with Dataview plugin enabled. Use no args (or query="help") to get DQL syntax docs.',
		inputSchema: {
			query: z.string().optional().describe('DQL query (TABLE/LIST/TASK). Omit or pass "help" for docs.'),
			format: z.enum(['markdown', 'json']).optional().describe('Result format (default: markdown)'),
		},
	}, async ({ query, format = 'markdown' }) => {
		await ensure_init();
		if (!query || query.trim().toLowerCase() === 'help') {
			return { content: [{ type: 'text', text: DOCS }] };
		}
		try {
			const result = run_dql(query);
			if (format === 'json') {
				return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
			}
			return { content: [{ type: 'text', text: format_result(result, query) }] };
		} catch (e) {
			return { content: [{ type: 'text', text: `DQL error: ${e.message}` }], isError: true };
		}
	});
}

function strip_cell(cell) {
	if (cell && typeof cell === 'object' && cell.path) {
		const name = cell.path.replace(/\\/g, '/').split('/').pop().replace(/\.md$/, '');
		return name;
	}
	if (Array.isArray(cell)) return cell.map(strip_cell).join(' ');
	return cell == null ? '' : String(cell);
}

function format_result(result, query) {
	const header = `> \`${query.replace(/\n/g, ' ').slice(0, 200)}\``;
	if (!result || result.error) return `${header}\n\n_${result?.error || 'no result'}_`;
	if (result.type === 'table' || result.headers) {
		const headers = result.headers;
		const rows = (result.values || []).map(r => `| ${r.map(strip_cell).join(' | ')} |`);
		const sep = `| ${headers.map(() => '---').join(' | ')} |`;
		return `${header}\n\n| ${headers.join(' | ')} |\n${sep}\n${rows.join('\n') || '_empty_'}`;
	}
	if (result.type === 'list') {
		const items = (result.values || []).map(v => `- ${strip_cell(v)}`);
		return `${header}\n\n${items.join('\n') || '_empty_'}`;
	}
	return `${header}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
}
