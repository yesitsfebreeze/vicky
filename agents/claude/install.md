# Installing Vicky for Claude Code

Vicky is a demand-driven knowledge base MCP server for Claude Code. It auto-detects information gaps, queues research, and enriches answers from project context.

## Prerequisites

- **Node.js** 18 or later (`node --version`)
- **npm** 9 or later (`npm --version`)
- Claude Code (any version)
- A project folder open in Claude Code

## Installation

### Step 1: Clone or download Vicky

```bash
git clone https://github.com/yesitsfebreeze/vicky ~/.claude/plugins/vicky
cd ~/.claude/plugins/vicky
npm install
```

**Alternative methods:**

- **Copy from dev:** `cp -r ~/dev/vicky ~/.claude/plugins/vicky && cd ~/.claude/plugins/vicky && npm install`
- **Download + extract:** Download from https://github.com/yesitsfebreeze/vicky/archive/refs/heads/main.zip, extract to `~/.claude/plugins/vicky`, then `npm install`

### Step 2: Create `.claude-plugin` manifest (Claude Code only)

Claude Code auto-discovers plugins in `~/.claude/plugins/` if they have a `.claude-plugin` manifest. Create it:

```bash
cat > ~/.claude/plugins/vicky/.claude-plugin << 'EOF'
{
  "name": "vicky",
  "version": "0.2.0",
  "description": "Demand-driven knowledge base: auto-enrich via research-gap",
  "mcp": {
    "command": "node",
    "args": ["src/index.js"]
  }
}
EOF
```

**Note:** Vicky plugin auto-initializes on session start. No manual registration needed in Claude Code.

### Step 3: Verify installation

1. **Check directory:**
   ```bash
   ls ~/.claude/plugins/vicky/src/index.js
   ```
   Should print: `~/.claude/plugins/vicky/src/index.js`

2. **Restart Claude Code** (or reload the session)

3. **Test in Claude Code:**
   ```
   /vic:research-gap "What is Phase 5 subdivision?"
   ```
   Should respond with KB status (found/gap).

## Troubleshooting

### MCP server not connecting

**Symptom:** "MCP error" when running `/vic:research-gap`

**Fix:**
1. Verify Node.js: `node --version` (needs 18+)
2. Verify npm: `npm --version` (needs 9+)
3. Reinstall deps: `cd ~/.claude/plugins/vicky && npm install`
4. Check manifest exists: `ls ~/.claude/plugins/vicky/.claude-plugin`
5. Restart Claude Code completely (not just reload)

### Plugin not found / not auto-discovered

**Symptom:** Skill not listed or `/vic:` commands not recognized

**Fix:**
1. **Check path:** `ls -la ~/.claude/plugins/vicky/`
2. **Check manifest:** `cat ~/.claude/plugins/vicky/.claude-plugin` should have valid JSON
3. **Check permissions:** `chmod 755 ~/.claude/plugins/vicky/src/index.js`
4. **Restart Claude Code** — it discovers plugins on startup

### Vault not creating / permission denied

**Symptom:** `.vicky/` directory not created, or "permission denied" errors

**Fix:**
1. Ensure project folder is writable: `touch /path/to/project/.test && rm /path/to/project/.test`
2. Check file system: some filesystems (NTFS on WSL, mounted SMB shares) have permission issues
3. Try in a different project folder
4. Check Claude Code has write permissions: `ls -ld /path/to/project/`

## Next Steps

- See [SKILL.md](../../SKILL.md) for usage and available commands
- See [update.md](update.md) for keeping Vicky current
- Check [MCP protocol docs](https://modelcontextprotocol.io) for advanced configuration

## Claude Code specific features

- **Auto-initialization:** Vault created automatically on first use
- **Skill listing:** Vicky skill auto-appears in skill selector
- **Slash commands:** `/vic:research`, `/vic:research-gap`, etc. available after install
- **Knowledge base:** `.vicky/` folder created in project root (add to .gitignore if desired)
