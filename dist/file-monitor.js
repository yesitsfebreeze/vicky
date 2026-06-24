import { existsSync, statSync, readdirSync } from "fs";
import { join } from "path";
import * as fs from "./fs.js";
import { relink_dir } from "./link.js";
import * as jobs from "./jobs.js";
const WATCH_FILES = [
  ".graphify/graph.json",
  // Main semantic graph
  ".graphify/.graphify_ast.json",
  // AST for importance analysis
  ".graphify/manifest.json"
  // File manifest
];
const WATCH_DIRS = [
  "pending",
  // Research queue
  "sources"
  // Source notes
];
class FileMonitor {
  constructor(notify) {
    this.notify = notify;
    this.fileStates = /* @__PURE__ */ new Map();
    this.dirStates = /* @__PURE__ */ new Map();
    this.pendingActions = /* @__PURE__ */ new Set();
    this.initialized = false;
  }
  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    for (const file of WATCH_FILES) {
      const path = join(fs.root(), file);
      if (existsSync(path)) {
        try {
          const stat = statSync(path);
          this.fileStates.set(file, { mtime: stat.mtime, size: stat.size });
        } catch (e) {
        }
      }
    }
    for (const dir of WATCH_DIRS) {
      const path = join(fs.root(), dir);
      if (existsSync(path)) {
        try {
          const files = readdirSync(path).filter((f) => f.endsWith(".md")).length;
          this.dirStates.set(dir, { count: files, mtime: statSync(path).mtime });
        } catch (e) {
        }
      }
    }
  }
  check() {
    if (!this.initialized) this.initialize();
    const changed = [];
    for (const file of WATCH_FILES) {
      const path = join(fs.root(), file);
      const exists = existsSync(path);
      const oldState = this.fileStates.get(file);
      if (exists) {
        try {
          const stat = statSync(path);
          const newState = { mtime: stat.mtime, size: stat.size };
          if (!oldState) {
            changed.push({ type: "file_created", file });
            this.fileStates.set(file, newState);
          } else if (oldState.mtime < newState.mtime || oldState.size !== newState.size) {
            changed.push({ type: "file_changed", file });
            this.fileStates.set(file, newState);
          }
        } catch (e) {
        }
      } else if (oldState) {
        changed.push({ type: "file_deleted", file });
        this.fileStates.delete(file);
      }
    }
    for (const dir of WATCH_DIRS) {
      const path = join(fs.root(), dir);
      const exists = existsSync(path);
      const oldState = this.dirStates.get(dir);
      if (exists) {
        try {
          const stat = statSync(path);
          const files = readdirSync(path).filter((f) => f.endsWith(".md")).length;
          const newState = { count: files, mtime: stat.mtime };
          if (!oldState) {
            changed.push({ type: "dir_created", dir, count: files });
            this.dirStates.set(dir, newState);
          } else if (oldState.count !== newState.count || oldState.mtime < newState.mtime) {
            changed.push({ type: "dir_changed", dir, count: files, oldCount: oldState.count });
            this.dirStates.set(dir, newState);
          }
        } catch (e) {
        }
      } else if (oldState) {
        changed.push({ type: "dir_deleted", dir });
        this.dirStates.delete(dir);
      }
    }
    return changed;
  }
  async react(changes) {
    if (changes.length === 0) return;
    for (const change of changes) {
      const actionKey = `${change.type}:${change.file || change.dir}`;
      if (this.pendingActions.has(actionKey)) continue;
      this.pendingActions.add(actionKey);
      setTimeout(() => {
        this.pendingActions.delete(actionKey);
        this._triggerAction(change);
      }, 500);
    }
  }
  _triggerAction(change) {
    const { type, file, dir } = change;
    if (type === "file_changed") {
      if (file.includes("graph.json")) {
        this._scheduleRelink();
      } else if (file.includes("_ast.json")) {
        this._scheduleLean();
      } else if (file.includes("manifest.json")) {
        this._scheduleRelink();
      }
    } else if (type === "dir_changed") {
      if (dir === "pending") {
        this._scheduleLearn();
      } else if (dir === "sources") {
        this._scheduleRelink();
      }
    } else if (type === "file_created") {
      if (file.includes("graph.json")) {
        this._scheduleRelink();
      }
    } else if (type === "dir_created") {
      if (dir === "pending") {
        this._scheduleLearn();
      }
    }
  }
  _scheduleRelink() {
    if (jobs.reject_if_running("relink")) return;
    if (this.notify) {
      this.notify("info", "vicky: detected graph change, auto-relinking...");
    }
    jobs.create("auto-relink");
  }
  _scheduleLearn() {
    if (jobs.reject_if_running("learn")) return;
    if (this.notify) {
      this.notify("info", "vicky: pending queue changed, auto-learning...");
    }
    jobs.create("auto-learn");
  }
}
function startMonitoring(notify, intervalMs = 1e4) {
  const monitor = new FileMonitor(notify);
  monitor.initialize();
  const loop = () => {
    try {
      const changes = monitor.check();
      if (changes.length > 0) {
        monitor.react(changes);
      }
    } catch (e) {
    }
  };
  const interval = setInterval(loop, intervalMs);
  return { stop: () => clearInterval(interval), monitor };
}
var file_monitor_default = FileMonitor;
export {
  FileMonitor,
  file_monitor_default as default,
  startMonitoring
};
