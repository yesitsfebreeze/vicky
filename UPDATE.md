# Updating Vicky

## Choose your agent

### Claude Code
See [`agents/claude/update.md`](agents/claude/update.md) for update procedures.

### Claude API (Python/Node.js)
See [`agents/api/update.md`](agents/api/update.md) for SDK updates.

### Generic Update

```bash
cd ~/.vicky  # or wherever you installed Vicky
git fetch origin main
git pull origin main
npm install
```

Then restart your agent.

## Rollback

If an update breaks something:

```bash
cd ~/.vicky
git log --oneline -10  # Find previous commit
git checkout <HASH>
npm install
```

Restart your agent.

## Check version

```bash
cd ~/.vicky
git log -1 --oneline
npm list
```

## Staying updated

- **GitHub releases:** https://github.com/yesitsfebreeze/vicky/releases
- **Commit history:** `git log --oneline`
- **Issues:** https://github.com/yesitsfebreeze/vicky/issues
