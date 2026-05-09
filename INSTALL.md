# Installation Guide

Vicky is an MCP plugin for coding agents. Install it in your `.claude/plugins/` directory.

## Choose your method

### Method 1: Clone from GitHub (recommended)

```bash
git clone https://github.com/yesitsfebreeze/vicky ~/.claude/plugins/vicky
cd ~/.claude/plugins/vicky
npm install
```

### Method 2: Copy from local development

```bash
cp -r ~/dev/vicky ~/.claude/plugins/vicky
cd ~/.claude/plugins/vicky
npm install
```

### Method 3: Manual setup

1. Create directory: `~/.claude/plugins/vicky`
2. Copy all files from repo into that directory
3. Run: `npm install` inside the plugin directory

### Method 4: Use curl + tar (minimal tools)

```bash
mkdir -p ~/.claude/plugins/vicky
curl -L https://github.com/yesitsfebreeze/vicky/archive/refs/heads/main.tar.gz | tar xz -C ~/.claude/plugins/vicky --strip-components=1
cd ~/.claude/plugins/vicky
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
- Verify directory: `~/.claude/plugins/vicky`
- Check `.claude-plugin` file exists
- Restart your agent/session

**MCP server error:**
- Verify Node.js version: `node --version` (needs 18+)
- Reinstall deps: `npm install`
- Check permissions on `.claude/plugins/vicky`

**Vault not creating:**
- Plugin needs write access to project directory
- Try opening a different project folder
- Check file system permissions

## Custom installation path

If not using `~/.claude/plugins/vicky`, update the MCP server path in `.claude-plugin` to your chosen location.

## Next steps

See [SKILL.md](SKILL.md) for usage and [UPDATE.md](UPDATE.md) for keeping it current.
