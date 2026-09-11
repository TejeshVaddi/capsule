import { db } from "./data.js";

const MIN_AGE_DAYS = 2; // an entry must be at least this old before it can be resurfaced

/**
 * Chooses an old journal entry to resurface for recall. Prefers the entry
 * least-recently (or never) recalled, weighted toward older memories.
 */
export async function pickEntryForRecall() {
  const all = await db.allEntries();
  const journals = all.filter((e) => e.type === "journal");
  const recalls = all.filter((e) => e.type === "recall");

  const now = Date.now();
  const eligible = journals.filter(
    (e) => now - new Date(e.date).getTime() >= MIN_AGE_DAYS * 24 * 60 * 60 * 1000
  );
  if (!eligible.length) return null;

  const lastRecalled = new Map();
  for (const r of recalls) {
    const prev = lastRecalled.get(r.recallOf);
    const t = new Date(r.date).getTime();
    if (!prev || t > prev) lastRecalled.set(r.recallOf, t);
  }

  eligible.sort((a, b) => {
    const aRecalled = lastRecalled.get(a.id) || 0;
    const bRecalled = lastRecalled.get(b.id) || 0;
    if (aRecalled !== bRecalled) return aRecalled - bRecalled; // never/least-recently recalled first
    return new Date(a.date) - new Date(b.date); // then oldest first
  });

  return eligible[0];
}

export function daysBetween(isoA, isoB) {
  return Math.round(Math.abs(new Date(isoA) - new Date(isoB)) / (24 * 60 * 60 * 1000));
}

export function formatFriendlyDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
