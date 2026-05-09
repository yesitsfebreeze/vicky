# Installing Vicky

Vicky is a demand-driven knowledge base MCP server. Installation varies by agent.

## Choose your agent

### Claude Code
See [`agents/claude/install.md`](agents/claude/install.md) for step-by-step setup.

### Claude API (Python/Node.js)
See [`agents/api/install.md`](agents/api/install.md) for SDK integration.

### Other agents
See generic guide below.

## Generic Installation

Vicky is an MCP server that exposes 5 tools via the Model Context Protocol.

### Prerequisites

- **Node.js** 18+
- **npm** 9+

### Setup

```bash
git clone https://github.com/yesitsfebreeze/vicky ~/.vicky
cd ~/.vicky
npm install
```

### Verify

Start the MCP server:
```bash
node src/index.js
```

Should output version and tool list without errors.

## Usage

Once running, call MCP tools in your agent:

```
mcp__vicky__research_gap "your question"
mcp__vicky__research
mcp__vicky__query "knowledge base lookup"
mcp__vicky__remember "title"
mcp__vicky__enqueue "research question"
```

See README.md for detailed usage.

## Next Steps

- Read [README.md](README.md) for workflows and examples
- Check [MCP protocol docs](https://modelcontextprotocol.io)
- Find agent-specific docs in `agents/` folder
