// What a session asks of you, in order, and the streak.
//
// Order is deliberate and fixed: journal first (it is the thing the rest is
// built from), then activities, then a recall visit if there is enough
// history to make one meaningful.
//
// On streaks: simulated use at a realistic 85% adherence produced longest
// streaks of only 5 to 8 days over 90 days. A streak that resets the instant
// someone misses a day would, for this audience, mostly display small numbers
// and feel like a reminder of failure. So one missed turn is forgiven per
// seven, and the number still survives a bad day.
//
// A streak counts whole periods, and a period is a day for someone who uses
// Capsule most days and a week for someone who uses it once a week. Counting
// days for a weekly user would show a broken streak forever, which is the
// opposite of what a streak is for. See rhythm.js.

import { db } from "./data.js?v=6fe1a667df";
import { currentRhythm, periodKey, periodsBetween } from "./rhythm.js?v=6fe1a667df";

export const GRACE_PER_WEEK = 1;

// Where today's two required activities are remembered (see activities.js).
export const REQUIRED_META = "requiredActivities";

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(aKey, bKey) {
  const a = new Date(aKey + "T00:00:00");
  const b = new Date(bKey + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

/** A stable per-day integer, so "today's activities" do not reshuffle on every render. */
export function daySeed(key = dateKey()) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
  return h;
}

/**
 * Works out what is done today and what is still open.
 * Recall is only asked for once there is an entry old enough to be worth
 * revisiting, so nobody is ever asked to remember yesterday.
 */
export async function getDailyPlan() {
  const today = dateKey();
  const entries = await db.allEntries();
  const log = await db.allActivityLog().catch(() => []);

  const todaysJournal = entries.find(
    (e) => e.type === "journal" && dateKey(new Date(e.date)) === today
  );
  const todaysRecall = entries.find(
    (e) => e.type === "recall" && dateKey(new Date(e.date)) === today
  );
  const todaysActivities = log.filter((r) => dateKey(new Date(r.date)) === today);

  // Recall needs something at least 3 days old to point at.
  const recallCandidates = entries.filter(
    (e) => e.type === "journal" && daysBetween(dateKey(new Date(e.date)), today) >= 3
  );
  const recallAvailable = recallCandidates.length > 0;

  // The activities step is done when today's two required activities are,
  // not when any two things were done. Extras never count toward it.
  const todaysPair = await db.getMeta(REQUIRED_META).catch(() => null);
  const requiredKeys = todaysPair?.date === today ? todaysPair.keys || [] : [];
  const doneKeys = new Set(todaysActivities.map((r) => r.detail?.contentKey));
  const requiredDone = requiredKeys.filter((k) => doneKeys.has(k)).length;
  const ACTIVITY_TARGET = 2;

  const tasks = [
    {
      key: "journal",
      title: "Tell Capsule about today",
      detail: "Speak or type whatever your day held. You can keep adding to it until bedtime.",
      view: "journal",
      done: Boolean(todaysJournal),
      progress: todaysJournal ? "Saved" : null,
    },
    {
      key: "activities",
      title: "Do today's 2 activities",
      detail: "Two short games or questions. They change each time.",
      view: "activities",
      done: requiredKeys.length > 0 && requiredDone >= requiredKeys.length,
      progress: requiredDone ? `${requiredDone} of ${ACTIVITY_TARGET} done` : null,
    },
  ];

  if (recallAvailable) {
    tasks.push({
      key: "recall",
      title: "Visit an earlier day",
      detail: "Capsule brings back a day from your journal and asks what you remember.",
      view: "recall",
      done: Boolean(todaysRecall),
      progress: todaysRecall ? "Visited" : null,
    });
  }

  const required = tasks.filter((t) => t.key !== "recall" || recallAvailable);
  const allDone = required.every((t) => t.done);
  const nextTask = required.find((t) => !t.done) || null;

  return { today, tasks, allDone, nextTask, recallAvailable, doneCount: required.filter(t => t.done).length, totalCount: required.length };
}

/* ---------------- Streak ---------------- */

async function readStreak() {
  return (await db.getMeta("streak")) || { count: 0, lastCompleted: null, unit: "day", graceUsed: [] };
}

const GRACE_WINDOW = 7; // periods

/**
 * Recomputes the streak from the completion history, forgiving one gap in
 * seven. `rhythm` decides what a period is; without one it is read from the
 * person's own entries.
 */
export async function getStreak(rhythm = null) {
  const r = rhythm || (await currentRhythm(await db.allEntries().catch(() => [])));
  const s = await readStreak();
  const unit = r.unit;
  if (!s.lastCompleted) return { count: 0, lastCompleted: null, atRisk: false, unit };

  // The rhythm changed (by hand or because their use changed). A count of
  // days does not mean the same thing as a count of weeks, so it starts
  // again from this period rather than showing a number that is not true.
  const now = periodKey(new Date(), r);
  if ((s.unit || "day") !== unit) {
    return { count: s.lastCompleted === now ? 1 : 0, lastCompleted: s.lastCompleted, atRisk: false, unit };
  }

  const gap = periodsBetween(s.lastCompleted, now, r);
  if (gap <= 1) return { ...s, unit, atRisk: gap === 1 };

  if (gap === 2 && (s.graceUsed || []).filter((g) => periodsBetween(g, now, r) <= GRACE_WINDOW).length < GRACE_PER_WEEK) {
    return { ...s, unit, atRisk: true, graceAvailable: true };
  }

  return { count: 0, lastCompleted: s.lastCompleted, atRisk: false, broken: true, unit };
}

/** Called when every required task is finished. Returns the new count. */
export async function completeToday(rhythm = null) {
  const r = rhythm || (await currentRhythm(await db.allEntries().catch(() => [])));
  const s = await readStreak();
  const now = periodKey(new Date(), r);
  if (s.lastCompleted === now && (s.unit || "day") === r.unit) return s.count; // already counted

  const sameUnit = (s.unit || "day") === r.unit;
  const gap = s.lastCompleted && sameUnit ? periodsBetween(s.lastCompleted, now, r) : null;
  let graceUsed = (s.graceUsed || []).filter((g) => periodsBetween(g, now, r) <= GRACE_WINDOW);
  let count;

  if (gap === null) count = 1;
  else if (gap === 1) count = s.count + 1;
  else if (gap === 2 && graceUsed.length < GRACE_PER_WEEK) {
    // Forgive the single missed turn and carry on.
    graceUsed.push(periodKey(new Date(Date.now() - r.periodDays * 86400000), r));
    count = s.count + 1;
  } else count = 1;

  await db.setMeta("streak", { count, lastCompleted: now, unit: r.unit, graceUsed });
  return count;
}

/** True once today's celebration has been shown, so it only plays once a day. */
export async function celebratedToday() {
  return (await db.getMeta("celebratedOn")) === dateKey();
}
export async function markCelebrated() {
  await db.setMeta("celebratedOn", dateKey());
}
