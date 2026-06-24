#!/usr/bin/env node
const mainModule = import("./main.js").catch((err) => {
  console.error("Failed to load main.js:", err.message);
  process.exit(1);
});
