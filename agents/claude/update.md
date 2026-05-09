# Updating Vicky for Claude Code

Keep Vicky up to date to get bug fixes, new features, and improvements.

## Check current version

```bash
cd ~/.claude/plugins/vicky
git log -1 --oneline
npm list
```

## Quickest update (recommended)

```bash
cd ~/.claude/plugins/vicky
git fetch origin main
git pull origin main
npm install
```

Then restart Claude Code.

## Update to specific version/commit

```bash
cd ~/.claude/plugins/vicky
git fetch origin main
git checkout <COMMIT_HASH>
npm install
```

Example: `git checkout c43a08c` (see commit history for details)

## Manual update (no git)

If git is unavailable:

1. Download: https://github.com/yesitsfebreeze/vicky/archive/refs/heads/main.zip
2. Extract to temp location
3. Copy files to `~/.claude/plugins/vicky` (skip `.vicky/` and `node_modules/`)
4. Run: `cd ~/.claude/plugins/vicky && npm install`

## Fresh install (nuke and rebuild)

If something breaks after update:

```bash
rm -rf ~/.claude/plugins/vicky
git clone https://github.com/yesitsfebreeze/vicky ~/.claude/plugins/vicky
cd ~/.claude/plugins/vicky
npm install
```

Then restart Claude Code.

## Rollback to previous version

If an update breaks something:

```bash
cd ~/.claude/plugins/vicky
git log --oneline -10  # Find previous commit
git checkout <PREVIOUS_HASH>
npm install
```

Restart Claude Code.

## Verify update

After updating, verify in Claude Code:

```
mcp__vicky__research_gap "test"
```

Should respond without errors.

## Claude Code specific

- **Auto-reload:** Claude Code doesn't auto-reload plugins. Restart the full application (not just reload) after updating.
- **Settings:** `.claude/settings.local.json` may override Vicky settings. Check if hooks/config changed after update.
- **Skill listing:** If skill doesn't appear after update, restart Claude Code completely.

## What updates include

- Bug fixes to tools
- New commands and features
- Documentation updates
- Performance improvements
- Dependency updates

Check GitHub: https://github.com/yesitsfebreeze/vicky/commits/main

## Staying informed

- **GitHub releases:** https://github.com/yesitsfebreeze/vicky/releases
- **Commit history:** `git log --oneline`
- **Issues:** https://github.com/yesitsfebreeze/vicky/issues
- **Discussions:** https://github.com/yesitsfebreeze/vicky/discussions
