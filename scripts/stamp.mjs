#!/usr/bin/env node
// Stamps every script and stylesheet address with a fingerprint of the code.
//
// Why: the app is plain ES modules, and GitHub Pages tells browsers to reuse
// each file for ten minutes. Right after a release, a browser can hold an old
// copy of one module and fetch a new copy of another. If the new one imports
// something the old one does not export, the whole app fails to start and the
// person sees a blank screen. This was seen in iPhone Safari: a stale daily.js
// next to a new activities.js left the page empty.
//
// With a fingerprint on every import ("./ui.js?v=3f9a1c2e"), a new release
// changes every address at once, so old and new files can never be mixed.
// The fingerprint is a hash of the code with the stamps removed, so running
// this twice changes nothing, and it only moves when the code does.
//
// Run with: npm run stamp   (or: node scripts/stamp.mjs)
// The pre-push check fails if the stamps are missing or out of date.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const STAMP = /\?v=[a-f0-9]+/g;
const RELATIVE_IMPORT = /((?:\bfrom\s+|\bimport\s*\(\s*)["'])(\.{1,2}\/[^"'?]+\.js)(?:\?v=[a-f0-9]+)?(["'])/g;
const PAGE_ASSET = /((?:src|href)=")((?:\/?)(?:js\/app\.js|css\/style\.css))(?:\?v=[a-f0-9]+)?(")/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function sourceFiles() {
  return [
    ...walk(join(ROOT, "js")).filter((f) => f.endsWith(".js")),
    ...walk(join(ROOT, "css")).filter((f) => f.endsWith(".css")),
  ].sort();
}

/** Hash of every script and stylesheet, ignoring the stamps themselves. */
export function fingerprint() {
  const hash = createHash("sha1");
  for (const f of sourceFiles()) {
    hash.update(relative(ROOT, f));
    hash.update(readFileSync(f, "utf8").replace(STAMP, ""));
  }
  return hash.digest("hex").slice(0, 10);
}

export function stampText(text, version, { html = false } = {}) {
  const re = html ? PAGE_ASSET : RELATIVE_IMPORT;
  return text.replace(re, (_, before, path, after) => `${before}${path}?v=${version}${after}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const version = fingerprint();
  let changed = 0;
  for (const f of sourceFiles().filter((x) => x.endsWith(".js"))) {
    const src = readFileSync(f, "utf8");
    const out = stampText(src, version);
    if (out !== src) { writeFileSync(f, out); changed++; }
  }
  for (const page of ["index.html"]) {
    const f = join(ROOT, page);
    const src = readFileSync(f, "utf8");
    const out = stampText(src, version, { html: true });
    if (out !== src) { writeFileSync(f, out); changed++; }
  }
  console.log(`  stamped version ${version} (${changed} file${changed === 1 ? "" : "s"} updated)`);
}
