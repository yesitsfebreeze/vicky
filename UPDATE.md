# Update Guide

Keep Vicky up to date. Multiple methods supported.

## Check current version

```bash
cd ~/.claude/plugins/vicky
git log -1 --oneline
```

## Method 1: Update via git (simplest)

```bash
cd ~/.claude/plugins/vicky
git fetch origin main
git pull origin main
npm install
```

## Method 2: Update to specific commit

```bash
cd ~/.claude/plugins/vicky
git fetch origin main
git checkout <COMMIT_HASH>
npm install
```

Example:
```bash
git checkout c43a08c  # Auto-research setup
git checkout 6d7658b  # Fix GitHub repo name
```

## Method 3: Fresh install (nuke and rebuild)

```bash
rm -rf ~/.claude/plugins/vicky
git clone https://github.com/yesitsfebreeze/vicky ~/.claude/plugins/vicky
cd ~/.claude/plugins/vicky
npm install
```

## Method 4: Manual update (no git)

1. Download latest from GitHub: https://github.com/yesitsfebreeze/vicky/archive/refs/heads/main.zip
2. Extract to temp location
3. Copy files over existing `~/.claude/plugins/vicky` (skip `.vicky/` directory)
4. Run: `npm install`

## Verify update

```bash
cd ~/.claude/plugins/vicky
npm list
git log -1
```

Restart Claude Code and test:
```
/vic:research-gap "test"
```

## Rollback to previous version

If update breaks something:

```bash
cd ~/.claude/plugins/vicky
git log --oneline -10  # Find previous commit
git checkout <PREVIOUS_COMMIT_HASH>
npm install
```

Then restart Claude Code.

## What updates include

- Bug fixes and improvements to tools
- New commands and features
- Updated documentation
- Performance improvements
- Dependency updates

Check [CHANGELOG](CHANGELOG.md) (if available) for details on each release.

## Staying informed

- Watch GitHub repo for releases
- Check commit history: `git log --oneline`
- Monitor issues: https://github.com/yesitsfebreeze/vicky/issues
