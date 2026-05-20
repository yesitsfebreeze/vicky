---
type: index
scope: sources
---

# Sources Index

Raw findings from research runs. One file = one topic.

## All sources by date

```dataview
TABLE WITHOUT ID file.link AS "Source", tags, date
FROM "vicky/sources"
WHERE type = "source"
SORT date DESC
```

## Untagged sources

```dataview
LIST
FROM "vicky/sources"
WHERE type = "source" AND (!tags OR length(tags) = 0)
```

## Sources with no inbound conclusion link

Sources never referenced by a conclusion — candidates to synthesize or prune.

```dataview
LIST
FROM "vicky/sources"
WHERE length(file.inlinks) = 0
```

## By tag

```dataview
TABLE WITHOUT ID rows.file.link AS "Sources", length(rows) AS "Count"
FROM "vicky/sources"
FLATTEN tags AS tag
WHERE tag
GROUP BY tag
SORT length(rows) DESC
```
