import { z } from 'zod';
import { basename } from 'path';
import { run_dql } from '../dashboard.js';
import { ensure_init } from '../init.js';

const DOCS = `DQL — Dataview Query Language.
Reference: https://blacksmithgu.github.io/obsidian-dataview/queries/structure/

Forms:
  LIST [<expr>] FROM <source> [WHERE ...] [SORT ...] [LIMIT n]
  TABLE [WITHOUT ID] col1 AS "Header", col2 ... FROM <source> ...
  TASK FROM <source> ...
  CALENDAR <date-field> FROM <source>

Sources:
  "folder"        pages in folder
  "a" OR "b"      union
  "a" AND -"b"    intersection minus
  #tag            by tag
  [[Note]]        outlinks of Note

Fields:
  file.link, file.name, file.folder, file.path
  file.inlinks, file.outlinks    (use length() for count)
  file.ctime, file.mtime, file.size
  <any frontmatter key>          e.g. type, date, tags, priority, status

Functions:
  length(list), choice(cond, a, b), contains(list, val), date(today),
  dur("14 days"), regexmatch(pat, str), lower(s), startswith(s, prefix)

Examples:
  TABLE WITHOUT ID file.link AS Node, length(file.inlinks) AS Inlinks
  FROM "conclusions"
  WHERE length(file.inlinks) > 0
  SORT length(file.inlinks) DESC LIMIT 20

  LIST FROM "sources" WHERE contains(tags, "perf")

  TABLE date, priority FROM "pending"
  WHERE status = "pending"
  SORT choice(priority = "high", 0, 1) ASC`;

function cell(value) {
	if (value && typeof value === 'object' && value.path) return basename(value.path, '.md');
	if (Array.isArray(value)) return value.map(cell).join(' ');
	return value == null ? '' : String(value);
}

function format_table(result, query_text) {
	const header = `> \`${query_text.replace(/\s+/g, ' ').slice(0, 200)}\``;
	const columns = result.headers;
	const rows = (result.values || []).map(row => `| ${row.map(cell).join(' | ')} |`);
	const separator = `| ${columns.map(() => '---').join(' | ')} |`;
	return `${header}\n\n| ${columns.join(' | ')} |\n${separator}\n${rows.join('\n') || '_empty_'}`;
}

function format_list(result, query_text) {
	const header = `> \`${query_text.replace(/\s+/g, ' ').slice(0, 200)}\``;
	const items = (result.values || []).map(value => `- ${cell(value)}`);
	return `${header}\n\n${items.join('\n') || '_empty_'}`;
}

function format_result(result, query_text) {
	if (result?.error) return `_${result.error}_`;
	if (result?.headers) return format_table(result, query_text);
	if (result?.type === 'list' || Array.isArray(result?.values)) return format_list(result, query_text);
	return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
}

export function register(server) {
	server.registerTool('dql', {
		description: 'Run a Dataview Query Language (DQL) query against the vault via Obsidian. Requires the vault to be open in Obsidian with the Dataview plugin enabled. Call with query="help" to get the syntax reference.',
		inputSchema: {
			query: z.string().optional().describe('DQL query (TABLE / LIST / TASK / CALENDAR). Omit or pass "help" for docs.'),
			format: z.enum(['markdown', 'json']).optional().describe('Result format (default: markdown)'),
		},
	}, async ({ query, format = 'markdown' }) => {
		await ensure_init();
		if (!query || query.trim().toLowerCase() === 'help') {
			return { content: [{ type: 'text', text: DOCS }] };
		}
		try {
			const result = run_dql(query);
			const text = format === 'json'
				? JSON.stringify(result, null, 2)
				: format_result(result, query);
			return { content: [{ type: 'text', text }] };
		} catch (e) {
			return { content: [{ type: 'text', text: `dql: ${e.message}` }], isError: true };
		}
	});
}
