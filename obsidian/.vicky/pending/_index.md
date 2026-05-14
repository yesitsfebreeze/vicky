---
type: index
scope: pending
---

# Pending Queue

Open research questions. Run `/vicky:learn` to drain, or `/vicky:research "<topic>"` to fetch + absorb in one pass.

## By priority

```dataview
TABLE WITHOUT ID file.link AS "Question", priority, requested_by, date
FROM "pending"
WHERE status = "pending"
SORT choice(priority = "high", 0, choice(priority = "med", 1, 2)) ASC, date ASC
```

## High priority only

```dataview
LIST
FROM "pending"
WHERE status = "pending" AND priority = "high"
SORT date ASC
```

## Oldest pending (over 7 days)

```dataview
TABLE WITHOUT ID file.link AS "Question", priority, date
FROM "pending"
WHERE status = "pending" AND date AND date(date) < date(today) - dur(7 days)
SORT date ASC
```

## By requester

```dataview
TABLE WITHOUT ID rows.file.link AS "Questions", length(rows) AS "Count"
FROM "pending"
WHERE status = "pending"
GROUP BY requested_by
SORT length(rows) DESC
```
