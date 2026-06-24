const jobs = /* @__PURE__ */ new Map();
function make_id(kind) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function sweep() {
  const now = Date.now();
  const cutoff = 60 * 60 * 1e3;
  for (const [id, j] of jobs) {
    if (j.status !== "running" && now - j.started > cutoff) jobs.delete(id);
  }
  if (jobs.size > 100) {
    const entries = [...jobs.entries()].filter(([, j]) => j.status !== "running").sort((a, b) => a[1].started - b[1].started);
    while (jobs.size > 100 && entries.length) {
      const [id] = entries.shift();
      jobs.delete(id);
    }
  }
}
function create(kind) {
  sweep();
  const id = make_id(kind);
  const now = Date.now();
  jobs.set(id, {
    kind,
    status: "running",
    started: now,
    progress: {},
    counts: null,
    error: null,
    last_update: now
  });
  return id;
}
function update(id, patch) {
  const j = jobs.get(id);
  if (!j) return;
  if (patch.progress) j.progress = { ...j.progress, ...patch.progress };
  if (patch.counts) j.counts = { ...j.counts || {}, ...patch.counts };
  if (patch.status) j.status = patch.status;
  if (patch.error !== void 0) j.error = patch.error;
  j.last_update = Date.now();
}
function get(id) {
  return jobs.get(id) || null;
}
function reject_if_running(kind) {
  for (const [id, j] of jobs) {
    if (j.kind === kind && j.status === "running") return id;
  }
  return null;
}
export {
  create,
  get,
  reject_if_running,
  sweep,
  update
};
