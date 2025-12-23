#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const folder = process.argv[2] || "dist";
const absFolder = path.resolve(process.cwd(), folder);

if (!fs.existsSync(absFolder) || !fs.statSync(absFolder).isDirectory()) {
  console.error(`Folder not found: ${folder}`);
  process.exit(1);
}

for (const entry of fs.readdirSync(absFolder)) {
  const src = path.join(absFolder, entry);
  if (!fs.statSync(src).isFile()) continue;
  if (path.extname(entry).toLowerCase() !== ".svg") continue;

  const ext = path.extname(entry);
  const base = path.basename(entry, ext);
  const newBase = slugify(base);
  const newName = newBase + ext.toLowerCase();

  if (newName === entry) continue;

  const uniqueName = uniquePath(absFolder, newName);
  fs.renameSync(src, path.join(absFolder, uniqueName));
}

function slugify(name) {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const hyphenated = normalized
    .replace(/[\s_]+/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return hyphenated || "file";
}

function uniquePath(dir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = filename;
  let i = 2;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${i}${ext}`;
    i += 1;
  }
  return candidate;
}
