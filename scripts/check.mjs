#!/usr/bin/env node
// Pre-flight checks for Capsule.
//
// These exist because a single missing comma once shipped to the live site and
// took every screen down: walkthrough.js failed to parse, so app.js never
// loaded, and the whole app rendered as a blank page. Nothing caught it,
// because the copy change had been eyeballed in an already-loaded page that
// was still running the previous version of the module.
//
// Everything here targets that class of failure: the app is a set of ES
// modules with no build step, so any parse error or unresolved import in any
// one file takes down the entire app rather than degrading part of it.
//
// Run with: npm run check   (or: node scripts/check.mjs)

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const fail = (file, msg) => failures.push({ file, msg });

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    // .claude holds local, git-ignored tooling that never ships.
    if (name === ".git" || name === "node_modules" || name === "scripts" || name === ".claude") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const jsFiles = files.filter((f) => f.endsWith(".js"));
const rel = (f) => relative(ROOT, f);

/* 1. Every JS file must parse AS AN ES MODULE.
      `node --check file.js` is not good enough and quietly passed the exact
      bug that took the site down: on a .js path it does not parse in module
      mode, so an error like a missing comma between object properties slips
      through. Feeding the source on stdin with --input-type=module is what
      actually reproduces how the browser parses these files. */
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ["--input-type=module", "--check"], {
      input: readFileSync(f, "utf8"),
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    const out = String(err.stderr || err.stdout || err.message);
    const line = out.split("\n").find((l) => /SyntaxError/.test(l)) || out.split("\n")[0];
    const where = out.split("\n").find((l) => /^\[stdin\]:\d+/.test(l));
    fail(rel(f), `does not parse: ${line.trim()}${where ? ` (line ${where.split(":")[1]})` : ""}`);
  }
}

/* 2. Every relative import must resolve. A missing file blanks the app the
      same way a parse error does, and is just as invisible until runtime. */
for (const f of jsFiles) {
  const src = readFileSync(f, "utf8");
  const specifiers = [
    ...src.matchAll(/^\s*(?:import|export)[^'"]*?from\s+["']([^"']+)["']/gm),
    ...src.matchAll(/\bimport\(\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);

  for (const spec of specifiers) {
    if (!spec.startsWith(".") && !spec.startsWith("/")) continue; // bare/CDN
    const target = spec.startsWith("/")
      ? join(ROOT, spec.split("?")[0])
      : resolve(dirname(f), spec.split("?")[0]);
    if (!existsSync(target)) fail(rel(f), `imports "${spec}" which does not exist`);
  }
}

/* 3. Local files referenced by index.html must exist. */
const indexPath = join(ROOT, "index.html");
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, "utf8");
  for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|data:|mailto:|#|\/\/)/.test(ref) || ref === "") continue;
    if (!existsSync(join(ROOT, ref.split("?")[0]))) fail("index.html", `references "${ref}" which does not exist`);
  }
} else {
  fail("index.html", "missing");
}

/* 4. Names imported from a local module must actually be exported by it.
      This catches the other silent blank-page cause: renaming or removing an
      export and missing one of its call sites. */
const exportsOf = new Map();
for (const f of jsFiles) {
  const src = readFileSync(f, "utf8");
  const names = new Set();
  for (const m of src.matchAll(/^\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^\s*export\s*\{([^}]+)\}/gm)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  if (/^\s*export\s+default/m.test(src)) names.add("default");
  exportsOf.set(resolve(f), names);
}

for (const f of jsFiles) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/^\s*import\s*\{([^}]+)\}\s*from\s+["'](\.[^"']+)["']/gm)) {
    const target = resolve(dirname(f), m[2].split("?")[0]);
    const known = exportsOf.get(target);
    if (!known) continue;
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && !known.has(name)) {
        fail(rel(f), `imports { ${name} } from "${m[2]}", which does not export it`);
      }
    }
  }
}

/* 4b. A function from another module must be imported before it is called.
      Removing an import while one call to it was left behind in the same
      file (localEntryCount on the Account page) parsed fine, resolved fine,
      and then threw "is not defined" as soon as the page opened. */
{
  const exportedFunctions = new Set();
  for (const f of jsFiles) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)) exportedFunctions.add(m[1]);
  }
  for (const f of jsFiles) {
    const src = readFileSync(f, "utf8");
    const known = new Set();
    for (const m of src.matchAll(/\b(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g)) known.add(m[1]);
    for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(",")) known.add(part.trim().split(/\s*:\s*/).pop().split("=")[0].trim());
    }
    for (const m of src.matchAll(/\bimport\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(",")) known.add(part.trim().split(/\s+as\s+/).pop().trim());
    }
    for (const m of src.matchAll(/\bimport\s+(?:\*\s+as\s+)?([A-Za-z0-9_$]+)\s+from/g)) known.add(m[1]);
    for (const name of exportedFunctions) {
      if (known.has(name)) continue;
      // A call on its own, not a method (".name(") or a method definition.
      const call = new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, "\\$")}\\(`, "m");
      const hit = src.match(call);
      if (!hit) continue;
      const line = src.slice(0, hit.index).split("\n").length;
      const text = src.split("\n")[line - 1];
      if (new RegExp(`^\\s*(?:async\\s+)?${name}\\s*\\([^)]*\\)\\s*\\{`).test(text)) continue;
      fail(rel(f), `calls ${name}() but never imports it (line ${line})`);
    }
  }
}

/* 5. An async function's result must be awaited before it is used.
      suggestActivities became async while one caller still did
      suggestActivities(...).filter(...). It parsed, it imported, and every
      journal save then threw after writing the entry, so people were told
      the save failed and invited to save again. This catches a call to any
      known async function followed directly by .something or [index]. */
const asyncNames = new Set();
for (const f of jsFiles) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\basync\s+function\s+([A-Za-z0-9_$]+)/g)) asyncNames.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*async\b/g)) asyncNames.add(m[1]);
}
const PROMISE_METHODS = new Set(["then", "catch", "finally"]);
for (const f of jsFiles) {
  const src = readFileSync(f, "utf8");
  for (const name of asyncNames) {
    const re = new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, "\\$")}\\(`, "g");
    for (const m of src.matchAll(re)) {
      const open = m.index + m[0].length - 1;
      const before = src.slice(Math.max(0, open - name.length - 40), open - name.length);
      if (/\b(await|function)\s*\(?\s*$/.test(before)) continue;
      let depth = 0, i = open;
      for (; i < src.length; i++) {
        if (src[i] === "(") depth++;
        else if (src[i] === ")" && --depth === 0) break;
      }
      const after = src.slice(i + 1).match(/^\s*(?:\.\s*([A-Za-z0-9_$]+)|(\[))/);
      if (!after || PROMISE_METHODS.has(after[1])) continue;
      const line = src.slice(0, open).split("\n").length;
      fail(rel(f), `uses the result of async ${name}() without await (line ${line})`);
    }
  }
}

/* 6. Every script and stylesheet address carries the current version stamp.
      Without it, a browser right after a release can mix an old cached module
      with a new one; one missing export and the whole app is a blank page.
      See scripts/stamp.mjs. */
{
  const { fingerprint } = await import("./stamp.mjs");
  const version = fingerprint();
  const stale = new Set();
  for (const f of jsFiles) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
      if (!m[1].endsWith(`?v=${version}`)) stale.add(rel(f));
    }
  }
  const html = readFileSync(indexPath, "utf8");
  for (const m of html.matchAll(/(?:src|href)="(\/?(?:js\/app\.js|css\/style\.css)[^"]*)"/g)) {
    if (!m[1].endsWith(`?v=${version}`)) stale.add("index.html");
  }
  for (const f of stale) fail(f, `has imports without the current version stamp (${version}). Run: npm run stamp`);
}

/* 7. No live credentials committed. The anon key is public by design; a
      service-role key or private key never is. */
for (const f of files.filter((x) => /\.(js|html|css|md|sql|ts|json)$/.test(x))) {
  const src = readFileSync(f, "utf8");
  if (/\bghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(src)) fail(rel(f), "contains a GitHub token");
  if (/BEGIN (RSA|OPENSSH|PRIVATE) KEY/.test(src)) fail(rel(f), "contains a private key");
  if (/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*InNlcnZpY2Vfcm9sZSI/.test(src)) fail(rel(f), "contains a service_role key");
}

/* 8. Every "Name as many as you can" category has a word list, and the check
      still tells a right answer from a wrong one. Without a list, nothing
      the person says would count. */
{
  const { FLUENCY_CATEGORIES } = await import("../js/activities-content.js");
  const { FLUENCY_LISTS, FLUENCY_ONE, FLUENCY_EXAMPLE, checkFluencyAnswer } = await import("../js/fluency-words.js");
  const file = "js/fluency-words.js";
  for (const { category } of FLUENCY_CATEGORIES) {
    const key = category.toLowerCase();
    if (!FLUENCY_LISTS[key] || !FLUENCY_ONE[key] || !FLUENCY_EXAMPLE[key]) fail(file, `no word list or wording for the category "${category}"`);
  }
  const counts = (c, t) => checkFluencyAnswer(c, t).added.length > 0;
  if (!counts("birds", "ducks") || counts("birds", "pond") || counts("animals", "iphone") || !counts("animals", "big brown bear")
    || counts("birds", "parakete") || checkFluencyAnswer("birds", "parakete").suggestion?.label !== "parakeet") {
    fail(file, "the category check no longer accepts right answers or rejects wrong ones");
  }
}

/* Report */
if (failures.length) {
  console.error(`\n  ${failures.length} problem${failures.length === 1 ? "" : "s"} found:\n`);
  for (const { file, msg } of failures) console.error(`   ${file}\n     ${msg}\n`);
  console.error("  Push blocked. The app has no build step, so nothing else will\n  catch these before they reach the live site.\n");
  process.exit(1);
}

console.log(`  checks passed (${jsFiles.length} JS files parsed, imports and references resolved)`);
