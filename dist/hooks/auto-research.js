#!/usr/bin/env node
import { existsSync, readdirSync } from "../fs-wrapper.js";
import * as fs from "../paths.js";
function hasPending() {
  const dir = fs.pending();
  if (!existsSync(dir)) return false;
  return readdirSync(dir).length > 0;
}
function notify() {
  console.log(JSON.stringify({
    status: "info",
    message: "Vicky: Pending research detected. Running auto-research..."
  }));
}
if (hasPending()) {
  notify();
}
export {
  hasPending
};
