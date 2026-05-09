# Installation Guide

Vicky is an MCP plugin for coding agents. Install it in your agent's plugins directory.

## Plugin directory by agent

Replace `<PLUGIN_DIR>` with your agent's plugins directory:
- **Claude Code**: `~/.claude/plugins/vicky`
- **Other agents**: `~/.agent/plugins/vicky`, `~/.config/agent/plugins/vicky`, or equivalent

Check your agent's documentation for the correct plugins directory.

## Choose your method

### Method 1: Clone from GitHub (recommended)

```bash
git clone https://github.com/yesitsfebreeze/vicky <PLUGIN_DIR>/vicky
cd <PLUGIN_DIR>/vicky
npm install
```

### Method 2: Copy from local development

```bash
cp -r ~/dev/vicky <PLUGIN_DIR>/vicky
cd <PLUGIN_DIR>/vicky
npm install
```

### Method 3: Manual setup

1. Create directory: `<PLUGIN_DIR>/vicky`
2. Copy all files from repo into that directory
3. Run: `npm install` inside the plugin directory

### Method 4: Use curl + tar (minimal tools)

```bash
mkdir -p <PLUGIN_DIR>/vicky
curl -L https://github.com/yesitsfebreeze/vicky/archive/refs/heads/main.tar.gz | tar xz -C <PLUGIN_DIR>/vicky --strip-components=1
cd <PLUGIN_DIR>/vicky
npm install
```

## Requirements

- **Node.js** 18 or later
- **npm** 9 or later
- Coding agent session with project folder open

## Verification

1. Restart your agent or session
2. Open a project folder
3. Vicky initializes on session start
4. Test: `/vic:research-gap "test question"`

## Troubleshooting

**Plugin not found:**
- Verify directory: `<PLUGIN_DIR>/vicky` exists
- Check plugin config file exists (`.claude-plugin` for Claude Code, or equivalent)
- Restart your agent/session

**MCP server error:**
- Verify Node.js version: `node --version` (needs 18+)
- Reinstall deps: `npm install`
- Check permissions on `<PLUGIN_DIR>/vicky`

**Vault not creating:**
- Plugin needs write access to project directory
- Try opening a different project folder
- Check file system permissions

## Plugin registration by agent

After installation, agents need to register Vicky differently:

### Claude Code

Plugin auto-discovered in `~/.claude/plugins/vicky` via `.claude-plugin` manifest.

### Other agents

Check your agent's documentation for plugin registration:
- Environment variables (e.g., `MCP_PLUGINS_PATH`)
- Config file (e.g., `settings.json`, `config.toml`)
- CLI flags (e.g., `--plugin-dir`)
- Manual MCP server registration

Vicky exposes an MCP server via `src/index.js`. Your agent needs to:
1. Point to the installed plugin directory
2. Start the MCP server: `node <PLUGIN_DIR>/vicky/src/index.js`
3. Register the 7 available tools

See [MCP protocol docs](https://modelcontextprotocol.io) for your agent's integration method.

## Custom installation path

Update your agent's plugin path configuration to point to your chosen location. See your agent's documentation for how to register plugins.

## Next steps

See [SKILL.md](SKILL.md) for usage and [UPDATE.md](UPDATE.md) for keeping it current.
