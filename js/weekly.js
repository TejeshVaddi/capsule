// Builds the weekly look back for the week that has just finished.
//
// Two parts: what the person did (days active, entries, activities, memory
// visits, plus snippets and photos), and how their metrics moved compared with
// the week before. Movement is reported in whichever direction it went.

import { db } from "./data.js?v=f5fa412c13";
import { dateKey } from "./daily.js?v=f5fa412c13";

export function startOfWeek(d = new Date()) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - c.getDay()); // Sunday
  return c;
}

function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }

export async function buildWeeklySummary(weekStart = startOfWeek()) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const all = await db.allEntries();
  const log = await db.allActivityLog().catch(() => []);

  const inWeek = (d) => { const t = new Date(d); return t >= weekStart && t < weekEnd; };

  const entries = all.filter((e) => inWeek(e.date));
  const journals = entries.filter((e) => e.type === "journal");
  const recalls = entries.filter((e) => e.type === "recall");
  const activities = log.filter((r) => inWeek(r.date));

  const daysActive = new Set(entries.map((e) => dateKey(new Date(e.date)))).size;

  // Previous week, for the person's own comparison.
  const prevStart = new Date(weekStart); prevStart.setDate(prevStart.getDate() - 7);
  const prevJournals = all.filter(
    (e) => e.type === "journal" && new Date(e.date) >= prevStart && new Date(e.date) < weekStart
  );

  const metric = (list, f) => mean(list.filter((e) => e.metrics).map((e) => f(e.metrics)));

  const compare = (label, now, before, higherWord, lowerWord) => {
    if (now === null) return null;
    if (before === null) return { label, text: "This is your first week of this to compare against.", direction: "new" };
    const change = (now - before) / Math.max(Math.abs(before), 0.0001);
    if (Math.abs(change) < 0.12) return { label, text: "About the same as last week.", direction: "steady" };
    return { label, text: change > 0 ? higherWord : lowerWord, direction: change > 0 ? "up" : "down" };
  };

  const movements = [
    compare("Entry length",
      metric(journals, (m) => m.wordCount), metric(prevJournals, (m) => m.wordCount),
      "Longer than last week.", "Shorter than last week."),
    compare("Naming words",
      metric(journals, (m) => m.nounRate), metric(prevJournals, (m) => m.nounRate),
      "A larger share of specific naming words than last week.",
      "A smaller share of specific naming words than last week."),
    compare("Hesitations",
      metric(journals, (m) => m.disfluencyRate), metric(prevJournals, (m) => m.disfluencyRate),
      "More pauses and repeats than last week.", "Fewer pauses and repeats than last week."),
  ].filter(Boolean);

  // Snippets for the collage. A day only gets a note if it actually has
  // something to say; a sticky reading "Quiet day." is worse than no sticky.
  const snippets = journals
    .slice(0, 12)
    .map((e) => ({ id: e.id, date: e.date, text: snippetFor(e.text) }))
    .filter((s) => s.text);

  return {
    weekStart, weekEnd,
    daysActive,
    journalCount: journals.length,
    recallCount: recalls.length,
    activityCount: activities.length,
    photoEntryIds: journals.map((e) => e.id),
    snippets,
    movements,
    // Things that are true, good, and entirely about what they did.
    wins: buildWins({ daysActive, journals, activities, recalls }),
  };
}

// A snippet has to carry a memory, not just fill a card. Below this it is
// dropped rather than shown, so no sticky note ever reads "Quiet day."
const MIN_SNIPPET_WORDS = 6;
const MAX_SNIPPET_CHARS = 150;

function wordCount(s) {
  return (s.match(/[A-Za-z']+/g) || []).length;
}

/**
 * Picks a readable snippet: whole sentences, adding another if the first is
 * too thin to mean anything on its own. Returns null when the entry as a
 * whole has too little in it to be worth a note.
 */
function snippetFor(text) {
  const t = (text || "").trim();
  if (wordCount(t) < MIN_SNIPPET_WORDS) return null;

  const sentences = t.match(/[^.!?]+[.!?]*/g) || [t];
  let out = "";
  for (const s of sentences) {
    const next = (out ? out + " " : "") + s.trim();
    if (out && next.length > MAX_SNIPPET_CHARS) break;
    out = next;
    // Keep going only while the snippet is still too thin to stand alone.
    if (wordCount(out) >= MIN_SNIPPET_WORDS) break;
  }

  out = out.trim();
  if (wordCount(out) < MIN_SNIPPET_WORDS) return null;

  if (out.length > MAX_SNIPPET_CHARS) {
    out = out.slice(0, MAX_SNIPPET_CHARS).replace(/\s+\S*$/, "") + "...";
  } else if (out.length < t.length && !/[.!?]$/.test(out)) {
    out += "...";
  }
  return out;
}

/** Only claims that are verifiably true from what the person did. */
function buildWins({ daysActive, journals, activities, recalls }) {
  const wins = [];
  if (daysActive >= 6) wins.push("You showed up almost every day this week.");
  else if (daysActive >= 4) wins.push(`You showed up on ${daysActive} days this week.`);
  else if (daysActive > 0) wins.push(`You made time for Capsule on ${daysActive} day${daysActive === 1 ? "" : "s"} this week.`);

  if (journals.length) {
    const words = journals.reduce((a, e) => a + (e.metrics?.wordCount || 0), 0);
    wins.push(`You wrote ${words.toLocaleString()} words about your own life.`);
  }
  if (activities.length) wins.push(`You finished ${activities.length} activit${activities.length === 1 ? "y" : "ies"}.`);
  if (recalls.length) wins.push(`You went back to ${recalls.length} earlier day${recalls.length === 1 ? "" : "s"}.`);
  return wins;
}

/** Weekly page is offered once a week, on or after the first day of a new week. */
export async function shouldShowWeekly() {
  const lastShown = await db.getMeta("weeklyShownFor");
  const thisWeek = dateKey(startOfWeek());
  if (lastShown === thisWeek) return false;
  // Only worth showing if there was something in the week just gone.
  const prev = new Date(startOfWeek()); prev.setDate(prev.getDate() - 7);
  const s = await buildWeeklySummary(prev);
  return s.journalCount > 0 || s.activityCount > 0;
}

export async function markWeeklyShown() {
  await db.setMeta("weeklyShownFor", dateKey(startOfWeek()));
}
