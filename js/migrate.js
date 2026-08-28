// Metric migrations.
//
// Metric definitions can change when one turns out to be wrong. When that
// happens, entries saved under the old definition must be recomputed, not
// left to sit alongside new ones: a trend line mixing two definitions is
// worse than no trend line, because it looks authoritative and is not.
//
// Recomputing is lossless here because every entry keeps its original text.

import { db } from "./data.js";
import { analyzeText, compareRecallToOriginal, METRICS_VERSION } from "./analysis.js";

export async function migrateMetrics(onProgress = () => {}) {
  let entries;
  try {
    entries = await db.allEntries();
  } catch {
    return { migrated: 0, skipped: 0 };
  }

  const stale = entries.filter((e) => e.text && (!e.metrics || e.metrics.v !== METRICS_VERSION));
  if (!stale.length) return { migrated: 0, skipped: entries.length };

  let migrated = 0;
  for (const entry of stale) {
    const next = { ...entry, metrics: analyzeText(entry.text) };

    // Recall entries also carry a stored comparison against their original.
    if (entry.type === "recall" && entry.recallOf) {
      const original = entries.find((e) => e.id === entry.recallOf);
      if (original?.text) {
        next.recallComparison = compareRecallToOriginal(entry.text, original.text);
      }
    }

    await db.putEntry(next);
    migrated++;
    onProgress(migrated, stale.length);
  }

  return { migrated, skipped: entries.length - stale.length };
}
