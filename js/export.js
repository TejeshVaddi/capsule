// "Download my data": everything the person has saved, in one file.
//
// The file is a web page, so it opens on any phone or computer with a
// browser and reads like a journal: each day, its words, its photos, and the
// memory visits. The complete data (every entry, measurement and activity) is
// also inside it as JSON, so nothing is lost if it is ever read by a program.
//
// Saving is always a tap on a real link. A download started by the app
// itself, after the file has been put together, is quietly refused by some
// phone browsers, which is why the old button seemed to do nothing on an
// iPhone.

import { db } from "./data.js?v=584f5e5ecb";
import { escapeHtml } from "./ui.js?v=584f5e5ecb";
import { formatFriendlyDate } from "./recall.js?v=584f5e5ecb";

const ACTIVITY_NAMES = {
  naming: "Naming game",
  fluency: "How many can you name",
  "word-recall": "Five-word memory game",
  description: "A question or description",
  "photo-story": "Photo story",
  music: "Music moments",
};

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const dayOf = (iso) => formatFriendlyDate(iso);
const paragraphs = (text) => escapeHtml(text || "").split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");

/**
 * Puts the file together. `onProgress(message)` is called while photos are
 * gathered, which can take a moment when there are many.
 * Returns { blob, fileName, counts }.
 */
export async function buildExport({ onProgress = () => {} } = {}) {
  const entries = [...(await db.allEntries())].sort((a, b) => new Date(a.date) - new Date(b.date));
  const activityLog = [...(await db.allActivityLog().catch(() => []))].sort((a, b) => new Date(a.date) - new Date(b.date));
  const byId = new Map(entries.map((e) => [e.id, e]));

  // Photos, one entry at a time. Each is kept at its full original quality.
  const withPhotos = entries.filter((e) => e.photoIds?.length);
  const photosByEntry = new Map();
  const photoList = [];
  for (let i = 0; i < withPhotos.length; i++) {
    onProgress(`Getting your photos ready (${i + 1} of ${withPhotos.length} days)...`);
    const photos = await db.getPhotosForEntry(withPhotos[i].id).catch(() => []);
    const ready = [];
    for (const p of photos) {
      if (!p.blob) continue;
      try {
        ready.push({ id: p.id, name: p.name || "", src: await readAsDataUrl(p.blob) });
        photoList.push({ id: p.id, entryId: withPhotos[i].id, name: p.name || "", type: p.blob.type || "" });
      } catch { /* one unreadable photo does not stop the rest */ }
    }
    photosByEntry.set(withPhotos[i].id, ready);
  }
  onProgress("Putting your file together...");

  const exportedAt = new Date();
  const journals = entries.filter((e) => e.type === "journal");
  const visits = entries.filter((e) => e.type === "recall");

  // Built as separate pieces, so a file with many photos never has to exist
  // as one enormous string in the phone's memory.
  const parts = [];
  parts.push(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>My Capsule journal</title>
<style>
  body { margin: 0; background: #F3EFFB; color: #211A2E; font: 18px/1.6 Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { color: #4A2E5C; font-size: 32px; margin: 0 0 4px; }
  h2 { color: #4A2E5C; font-size: 22px; margin: 40px 0 12px; }
  .muted { color: #5b5068; font-size: 16px; }
  .day { background: #fff; border: 1px solid #C9B6E8; border-radius: 22px; padding: 20px 22px; margin: 16px 0; break-inside: avoid; }
  .day h3 { margin: 0 0 6px; font-size: 19px; color: #4A2E5C; }
  .tag { display: inline-block; font-size: 14px; font-weight: 700; padding: 2px 12px; border-radius: 999px; background: #e3ecf5; color: #2c5d82; margin-bottom: 8px; }
  .tag.visit { background: #FAF6B0; color: #4A2E5C; }
  .photos { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .photos img { max-width: 100%; width: 320px; height: auto; border-radius: 14px; }
  .hints { background: #FDFBE8; border-radius: 14px; padding: 10px 16px; margin: 8px 0; font-size: 16px; }
  .hints ul { margin: 4px 0 0; padding-left: 20px; }
  ul.log { padding-left: 20px; }
  footer { margin-top: 48px; font-size: 14px; color: #5b5068; }
  @media print { body { background: #fff; } .day { border-color: #ccc; } }
</style>
</head>
<body>
<main>
<h1>My Capsule journal</h1>
<p class="muted">Saved on ${escapeHtml(dayOf(exportedAt.toISOString()))}. ${journals.length} journal entr${journals.length === 1 ? "y" : "ies"}, ${visits.length} memory visit${visits.length === 1 ? "" : "s"}, ${activityLog.length} activit${activityLog.length === 1 ? "y" : "ies"}, ${photoList.length} photo${photoList.length === 1 ? "" : "s"}.</p>
<p class="muted">This file is yours. It opens in any web browser, and it works without the internet.</p>
<h2>Your days</h2>
`);

  for (const e of entries) {
    const isVisit = e.type === "recall";
    let body = `<section class="day"><span class="tag${isVisit ? " visit" : ""}">${isVisit ? "Memory visit" : "Journal"}</span>`;
    body += `<h3>${escapeHtml(dayOf(e.date))}</h3>`;
    if (isVisit) {
      const original = byId.get(e.recallOf);
      if (original) body += `<p class="muted">Remembering ${escapeHtml(dayOf(original.date))}.</p>`;
      const hints = e.recallComparison?.hints || [];
      if (hints.length) body += `<div class="hints">Hints shown:<ul>${hints.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul></div>`;
    }
    body += paragraphs(e.text);
    parts.push(body);
    const photos = photosByEntry.get(e.id) || [];
    if (photos.length) {
      parts.push(`<div class="photos">`);
      for (const p of photos) {
        parts.push(`<img alt="${escapeHtml(p.name || "A photo from this day")}" data-photo-id="${escapeHtml(p.id)}" src="`);
        parts.push(p.src);
        parts.push(`" />`);
      }
      parts.push(`</div>`);
    }
    parts.push(`</section>\n`);
  }
  if (!entries.length) parts.push(`<p>No entries yet.</p>`);

  if (activityLog.length) {
    parts.push(`<h2>Activities</h2><ul class="log">`);
    for (const a of activityLog) {
      const name = ACTIVITY_NAMES[a.kind] || a.kind;
      const extra = a.kind === "fluency" && a.detail?.category
        ? ` (${escapeHtml(a.detail.category)}: ${Number(a.detail.count) || 0} named)`
        : "";
      parts.push(`<li>${escapeHtml(dayOf(a.date))}: ${escapeHtml(name)}${extra}</li>`);
    }
    parts.push(`</ul>`);
  }

  // Everything, exactly as stored, for a program to read. "</" is escaped so
  // nothing in the text can end the script block early.
  const data = {
    app: "Capsule",
    exportedAt: exportedAt.toISOString(),
    note: "Personal journaling data. Photos are in the page above, matched by data-photo-id.",
    entries,
    activityLog,
    photos: photoList,
  };
  parts.push(`
<footer>Capsule is a journaling and cognitive-engagement tool. It is not a medical device and does not diagnose any condition.</footer>
</main>
<script type="application/json" id="capsule-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
</body>
</html>
`);

  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}`;
  return {
    blob: new Blob(parts, { type: "text/html" }),
    fileName: `capsule-journal-${stamp}.html`,
    counts: { entries: entries.length, photos: photoList.length, activities: activityLog.length },
  };
}
