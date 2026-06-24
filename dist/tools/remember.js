import { z } from "zod";
import { join, basename } from "path";
import * as fs from "../paths.js";
import { save_note } from "../vault.js";
import { ensure_init } from "../init.js";
function register(server) {
  server.registerTool("remember", {
    description: "Save key points or findings into the source vault. Conclusions are not auto-spawned \u2014 call `conclude` once you have a synthesised takeaway.",
    inputSchema: {
      title: z.string().describe("Topic title"),
      content: z.string().describe("Key points or findings (markdown)"),
      folder: z.string().optional().describe('Subfolder inside vicky/sources (e.g. "nanite", "physics")'),
      tags: z.array(z.string()).optional().describe("Tags"),
      sources: z.array(z.string()).optional().describe("Upstream sources this note derives from \u2014 written as [[wikilinks]] in body + sources: frontmatter"),
      related: z.array(z.string()).optional().describe("Sibling notes \u2014 written as [[wikilinks]] in body + related: frontmatter")
    }
  }, async ({ title, content, folder, tags = [], sources = [], related = [] }) => {
    await ensure_init();
    if (folder && /^(conclusion|conclusions)$/i.test(folder.trim())) {
      return { content: [{ type: "text", text: "remember writes to vicky/sources/ only. To save a derived conclusion, call `conclude` instead." }], isError: true };
    }
    const dir = folder ? join(fs.sources(), folder) : fs.sources();
    const merged = Array.from(/* @__PURE__ */ new Set(["source", ...tags.filter((t) => t !== "research")]));
    const path = save_note(title, content, { dir, tags: merged, type: "source", sources, related, id_filename: true });
    const slug = basename(path).replace(/\.md$/, "");
    return { content: [{ type: "text", text: `Saved: ${path}
ID: ${slug}` }] };
  });
}
export {
  register
};
