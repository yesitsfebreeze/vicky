# Vicky KB Skill

Demand-driven knowledge base. Auto-enrich answers from project context.

## What it does

- `/vic:research-gap "question"` - query KB, auto-enqueue gaps
- `/vic:research` - process gap queue, enrich conclusions
- `/vic:remember "title"` - save findings to vault
- Auto-detects knowledge gaps, queues research, enriches on-demand

## Activation

Auto-invokes on session start via `init()`.
Initializes vault + graphs if needed.
Always returns usage instructions.

## Usage

After skill activates (automatic):
```
Ask question → research-gap auto-checks KB → found: answer | gap: queue for research
Run /vic:research when ready to process queue
```

No manual setup. Just ask questions.
