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

### Step 2: Register the MCP server

Claude Code does not auto-discover plain directories under `~/.claude/plugins/` — those slots are reserved for marketplace-installed plugins cached under `~/.claude/plugins/cache/`. Register vicky as a user-scope MCP server instead:

```bash
claude mcp add vicky --scope user node "$HOME/.claude/plugins/vicky/src/index.js"
```

On Windows (Git Bash / PowerShell), pass an absolute path:

```bash
claude mcp add vicky --scope user node "C:/Users/sayhe/.claude/plugins/vicky/src/index.js"
```

Verify it is connected:

```bash
claude mcp list | grep vicky
# vicky: node .../src/index.js - ✓ Connected
```

### Step 3: Add the SessionStart hook

The hook runs `src/init.js`, which creates the `.vicky/` vault (sources, conclusions, pending, graphs) if missing and prints the active-skill banner.

Edit `~/.claude/settings.json` and add (or merge into) a `hooks` block:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"C:/Users/sayhe/.claude/plugins/vicky/src/init.js\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Replace `C:/Users/sayhe` with your own home directory (use forward slashes on Windows; `$HOME/.claude/...` works on macOS/Linux). For project-scope activation, put the same block in `<project>/.claude/settings.json` instead.

Verify the hook command works from a shell before restarting Claude Code:

```bash
node "$HOME/.claude/plugins/vicky/src/init.js"
# → prints JSON with status: "ready"
```

**Note:** Vicky auto-initializes on session start once the hook is wired. No additional registration needed.

### Step 3: Verify installation

1. **Check directory:**
   ```bash
   ls ~/.claude/plugins/vicky/src/index.js
   ```
   Should print: `~/.claude/plugins/vicky/src/index.js`

2. **Restart Claude Code** (or reload the session)

3. **Test in Claude Code:**
   ```
   mcp__vicky__research_gap "What is Phase 5 subdivision?"
   ```
   Should respond with KB status (found/gap).

## Troubleshooting

### MCP server not connecting

**Symptom:** "MCP error" when running `mcp__vicky__research_gap`

**Fix:**
1. Verify Node.js: `node --version` (needs 18+)
2. Verify npm: `npm --version` (needs 9+)
3. Reinstall deps: `cd ~/.claude/plugins/vicky && npm install`
4. Check manifest exists: `ls ~/.claude/plugins/vicky/.claude-plugin`
5. Restart Claude Code completely (not just reload)

### Plugin not found / not auto-discovered

**Symptom:** Skill not listed or MCP tools not recognized

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

- See README.md for usage and available tools
- See update.md for keeping Vicky current
- Check [MCP protocol docs](https://modelcontextprotocol.io) for advanced configuration

## Claude Code specific features

- **Auto-initialization:** Vault created automatically on first use
- **Direct MCP tools:** Call `mcp__vicky__research`, `mcp__vicky__research_gap`, `mcp__vicky__query`, `mcp__vicky__enqueue`, `mcp__vicky__remember` directly in any prompt
- **Knowledge base:** `.vicky/` folder created in project root (add to .gitignore if desired)
