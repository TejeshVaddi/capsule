// How often this person uses Capsule, and everything that should bend to it.
//
// Capsule began as a daily app: a streak of days, "today's two activities",
// and a week counted in days. Some people use it once a week, or a few times
// a week, and for them a daily streak only ever shows a broken number. So
// the rhythm is worked out from what they actually do (or set by hand), and
// the streak, the turn-taking between activities, and the wording all follow
// it. Nothing asks for more often than their own rhythm.

import { db } from "./data.js?v=9bbaea5e28";

// Kept here rather than imported from daily.js: daily.js reads the rhythm,
// and a module cannot wait on one that is waiting on it.
function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(aKey, bKey) {
  return Math.round((new Date(bKey + "T00:00:00") - new Date(aKey + "T00:00:00")) / 86400000);
}

export const RHYTHM_META = "rhythm"; // "auto" | "daily" | "weekly"

export const RHYTHMS = {
  daily: {
    key: "daily",
    label: "Most days",
    // One session per day, so a streak counts days.
    periodDays: 1,
    unit: "day",
    units: "days",
    // A session's activities step aside for about this long afterwards.
    stepAsideDays: 1.5,
    // Not done for this long counts as fresh again.
    freshAfterDays: 7,
  },
  weekly: {
    key: "weekly",
    label: "Once a week",
    periodDays: 7,
    unit: "week",
    units: "weeks",
    stepAsideDays: 9,
    freshAfterDays: 35,
  },
};

/** Sunday-based start of the week that holds `d`. */
export function startOfPeriod(d, rhythm) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  if (rhythm.periodDays > 1) c.setDate(c.getDate() - c.getDay());
  return c;
}

/** The key of the day or week that holds `d`: what a streak counts. */
export function periodKey(d = new Date(), rhythm = RHYTHMS.daily) {
  return dateKey(startOfPeriod(d, rhythm));
}

/** How many periods lie between two period keys. */
export function periodsBetween(aKey, bKey, rhythm) {
  return Math.round(daysBetween(aKey, bKey) / rhythm.periodDays);
}

/**
 * The rhythm to use: what the person set, or what their own entries show.
 * Read from the gaps between journal days: a typical gap of three days or
 * more is a weekly rhythm. Until there are a few entries, daily is assumed,
 * which is what a new person sees anyway.
 */
export function rhythmFrom(entries, setting = "auto") {
  if (setting === "daily" || setting === "weekly") return { ...RHYTHMS[setting], chosen: true };
  const days = [...new Set(entries.filter((e) => e.type === "journal").map((e) => dateKey(new Date(e.date))))].sort();
  if (days.length < 4) return { ...RHYTHMS.daily, chosen: false, unsure: true };
  const recent = days.slice(-12);
  const gaps = recent.slice(1).map((d, i) => daysBetween(recent[i], d)).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  return { ...(median >= 3 ? RHYTHMS.weekly : RHYTHMS.daily), chosen: false, medianGap: median };
}

/** The rhythm, including the person's own setting. */
export async function currentRhythm(entries) {
  const setting = (await db.getMeta(RHYTHM_META).catch(() => null)) || "auto";
  return rhythmFrom(entries, setting);
}

export async function setRhythmSetting(value) {
  await db.setMeta(RHYTHM_META, value);
}
export async function getRhythmSetting() {
  return (await db.getMeta(RHYTHM_META).catch(() => null)) || "auto";
}
