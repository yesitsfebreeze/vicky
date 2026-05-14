---
type: dashboard
---

# Vicky Dashboard

Live views over the KB. Requires the Dataview plugin (DQL + JS).

> Configure focus + workflow in [[WORKFLOW]].

## Counts

```dataview
TABLE WITHOUT ID type AS "Type", length(rows) AS "Count"
FROM "."
WHERE type
GROUP BY type
SORT length(rows) DESC
```

## Recent additions (last 14 days)

```dataview
TABLE file.folder AS "Folder", type, date, tags
FROM "."
WHERE date AND date(date) >= date(today) - dur(14 days)
SORT date DESC
LIMIT 25
```

## Most important nodes (hub ranking)

Most-linked = most referenced. Inbound link count is a proxy for centrality.

```dataview
TABLE WITHOUT ID file.link AS "Node", length(file.inlinks) AS "Inlinks", length(file.outlinks) AS "Outlinks", type
FROM "conclusions" OR "sources"
WHERE length(file.inlinks) > 0
SORT length(file.inlinks) DESC
LIMIT 20
```

## Pending queue

```dataview
TABLE WITHOUT ID file.link AS "Question", priority, requested_by, date
FROM "pending"
WHERE status = "pending"
SORT choice(priority = "high", 0, choice(priority = "med", 1, 2)) ASC, date ASC
```

## Sources awaiting synthesis

Sources with no inbound link from a conclusion — candidates for the next `conclude` pass.

```dataview
TABLE WITHOUT ID file.link AS "Source", length(file.inlinks) AS "Inlinks", date
FROM "sources"
WHERE length(filter(file.inlinks, (l) => startswith(meta(l).folder, "conclusions"))) = 0
SORT length(file.inlinks) DESC, date DESC
LIMIT 25
```

## Orphans (isolated nodes)

No inbound, no outbound links. Candidates for `relink`.

```dataview
LIST
FROM "conclusions" OR "sources"
WHERE length(file.inlinks) = 0 AND length(file.outlinks) = 0
LIMIT 25
```

## Stale conclusions

Old conclusions with few inbound links — verify or merge.

```dataview
TABLE WITHOUT ID file.link AS "Conclusion", length(file.inlinks) AS "Inlinks", date
FROM "conclusions"
WHERE date AND date(date) < date(today) - dur(60 days) AND length(file.inlinks) < 2
SORT date ASC
LIMIT 20
```

## By focus (from WORKFLOW.md)

```dataviewjs
const wf = dv.page("WORKFLOW");
const focus = wf?.active_focus ?? [];
if (!focus.length) {
  dv.paragraph("_No `active_focus` set in WORKFLOW.md — showing nothing._");
} else {
  dv.header(4, "Focus: " + focus.join(", "));
  const pages = dv.pages('"conclusions" or "sources"')
    .where(p => (p.tags ?? []).some(t => focus.includes(t))
             || focus.some(f => (p.file.path ?? "").toLowerCase().includes(f.toLowerCase())));
  dv.table(["Node", "Type", "Tags", "Date"],
    pages
      .sort(p => p.date, "desc")
      .limit(25)
      .map(p => [p.file.link, p.type, p.tags, p.date]));
}
```

## Tag cloud

```dataview
TABLE WITHOUT ID rows.file.link AS "Notes", length(rows) AS "Count"
FROM "."
FLATTEN tags AS tag
WHERE tag
GROUP BY tag
SORT length(rows) DESC
LIMIT 30
```

## Research activity (last 30 days, daily)

```dataviewjs
const since = dv.date("today").minus(dv.duration("30 days"));
const pages = dv.pages('"sources" or "conclusions" or "pending"')
  .where(p => p.date && dv.date(p.date) >= since);
const buckets = {};
for (const p of pages) {
  const k = p.date;
  buckets[k] = (buckets[k] ?? 0) + 1;
}
const rows = Object.entries(buckets).sort((a,b) => a[0] < b[0] ? 1 : -1);
dv.table(["Day", "Notes"], rows);
```
