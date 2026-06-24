import { z } from "zod";
import { ensure_init } from "../init.js";
function register(server, notify) {
  server.registerTool("web-search", {
    description: "Initiate web search and save findings. Returns instructions for Claude to follow.",
    inputSchema: {
      question: z.string().describe("Question to research"),
      context: z.string().optional().describe("Why this is important / what problem to solve")
    }
  }, async ({ question, context }) => {
    await ensure_init();
    const instruction = `VICKY_WEB_SEARCH_TASK:
Question: ${question}
${context ? `Context: ${context}` : ""}

Instructions:
1. Use your WebSearch tool to research this question thoroughly
2. Synthesize key findings and insights
3. Call vicky:remember with title="${question}" and the findings you discovered

This saves the research to Vicky's knowledge base for future queries.`;
    notify("info", `vicky: initiated web search for "${question}"`);
    return {
      content: [{
        type: "text",
        text: instruction
      }]
    };
  });
}
export {
  register
};
