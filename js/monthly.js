// The monthly note: a short word about how the month went, shown only when
// most of what Capsule measures has moved the good way.
//
// Why only then. Someone with a memory condition does not need a monthly
// notice that their measures fell; it is discouraging, it is not a health
// result, and Capsule cannot say what caused it. So a bad month passes in
// silence, and the only thing that changes is which activities come up, in
// the areas that slipped (see focus.js).
//
// Nothing here diagnoses anything, promises that anything will improve, or
// compares the person with anyone but themselves a month earlier. The
// Trends page still shows every measure in both directions, whatever the
// note says, so nothing is hidden from anyone who looks.

import { db } from "./data.js?v=bad5e1f123";
import { windowSamples } from "./analysis.js?v=bad5e1f123";
import { comparableRecalls } from "./recall.js?v=bad5e1f123";
import { dateKey } from "./daily.js?v=bad5e1f123";
import { explain } from "./meaning.js?v=bad5e1f123";

export const MONTHLY_META = "monthlyShownFor";

const DAY = 86400000;
const MONTH = 30 * DAY;
// A month with fewer entries than this is not compared: someone who wrote
// three times has not said enough for a month to mean anything.
const MIN_ENTRIES = 3;
// How much a measure has to move before it counts as having moved at all.
const MIN_CHANGE = 0.05;

const DOWN_IS_GOOD = new Set(["pronounRate", "graphRepetition", "disfluencyRate"]);

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const nums = (a) => a.filter((v) => typeof v === "number" && !Number.isNaN(v));

/**
 * One measure, this month against the month before.
 * `better` says which direction is the good one.
 * Returns "up", "down" or "steady", or null when there is too little.
 */
function moved(now, before, better = "up") {
  const a = mean(nums(now));
  const b = mean(nums(before));
  if (a === null || b === null || Math.abs(b) < 1e-9) return null;
  const change = (a - b) / Math.abs(b);
  if (Math.abs(change) < MIN_CHANGE) return "steady";
  const up = change > 0;
  return (up && better === "up") || (!up && better === "down") ? "up" : "down";
}

/**
 * How the last month compares with the month before it.
 * { ready, positive, good: [sentences], moved: {up, down, steady} }
 * `positive` is true when clearly more measures moved the good way than the
 * other, which is the only case in which anything is shown.
 */
export function monthlyReview(entries, activityLog = [], now = new Date()) {
  const at = now.getTime();
  const inWindow = (list, from, to) => list.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= at - from && t < at - to;
  });

  const journals = entries.filter((e) => e.type === "journal" && e.metrics);
  const thisMonth = inWindow(journals, MONTH, 0);
  const lastMonth = inWindow(journals, 2 * MONTH, MONTH);
  if (thisMonth.length < MIN_ENTRIES || lastMonth.length < MIN_ENTRIES) {
    return { ready: false, positive: false, good: [], moved: { up: 0, down: 0, steady: 0 } };
  }

  const results = [];
  // Each one carries what it means, so a good month says why it is good.
  const add = (direction, sentence, key = null) => {
    if (!direction) return;
    const meaning = key && direction === "up" ? explain(key, DOWN_IS_GOOD.has(key) ? "down" : "up") : null;
    results.push({ direction, sentence, means: meaning?.means || null });
  };
  const metric = (list, f) => list.map((e) => f(e.metrics));

  add(moved(metric(thisMonth, (m) => m.wordCount), metric(lastMonth, (m) => m.wordCount)),
    "Your entries have been longer than the month before.", "wordCount");
  add(moved(metric(thisMonth, (m) => m.nounRate), metric(lastMonth, (m) => m.nounRate)),
    "You have been naming things more often than the month before.", "nounRate");
  add(moved(metric(thisMonth, (m) => m.pronounRate), metric(lastMonth, (m) => m.pronounRate), "down"),
    "You have leaned on words like it and they less than the month before.", "pronounRate");
  add(moved(metric(thisMonth, (m) => m.graph?.meanEdgeWeight), metric(lastMonth, (m) => m.graph?.meanEdgeWeight), "down"),
    "You have come back to the same words less often than the month before.", "graphRepetition");

  // The word graph and the range of words, in same-length stretches of text.
  const nowText = windowSamples(thisMonth.map((e) => e.text));
  const beforeText = windowSamples(lastMonth.map((e) => e.text));
  add(moved(nowText.map((w) => w.linksBack), beforeText.map((w) => w.linksBack)),
    "Your words have tied back to one another more than the month before.", "graphLinksBack");
  add(moved(nowText.map((w) => w.linksPerWord), beforeText.map((w) => w.linksPerWord)),
    "Your words have led into one another more than the month before.");
  add(moved(nowText.map((w) => w.variety), beforeText.map((w) => w.variety)),
    "You have used a wider range of words than the month before.", "vocabRichness");

  // Memory visits, comparing only visits that had the same amount of help.
  const visits = comparableRecalls(entries.filter((e) => e.type === "recall" && e.recallComparison));
  add(moved(inWindow(visits, MONTH, 0).map((e) => e.recallComparison.overlapRatio),
            inWindow(visits, 2 * MONTH, MONTH).map((e) => e.recallComparison.overlapRatio)),
    "More of each day has come back in your memory visits.", "recallDetail");

  // The games, each against the same game a month earlier.
  const games = [
    ["naming", (d) => (d.total ? d.gotten / d.total : null), "You have found more of the words in the naming game."],
    ["fluency", (d) => d.count, "You have named more things in a minute than the month before."],
    ["switching", (d) => d.switches, "You have crossed between two subjects more often."],
    ["bridge", (d) => d.distinctWords, "Your word bridges have had more steps in them."],
    ["chain", (d) => d.wordCount, "You have said more when telling something start to finish."],
    ["word-recall", (d) => (d.total ? d.found / d.total : null), "You have remembered more of the five words."],
    ["description", (d) => d.wordCount, "You have said more in answer to a question."],
  ];
  for (const [kind, score, sentence] of games) {
    const of = (from, to) => inWindow(activityLog.filter((r) => r.kind === kind), from, to).map((r) => score(r.detail || {}));
    const a = of(MONTH, 0);
    const b = of(2 * MONTH, MONTH);
    if (nums(a).length >= 2 && nums(b).length >= 2) add(moved(a, b), sentence, kind);
  }

  const up = results.filter((r) => r.direction === "up");
  const down = results.filter((r) => r.direction === "down");
  const steady = results.filter((r) => r.direction === "steady");
  return {
    ready: results.length >= 3,
    // Clearly more went the good way than the other, and at least a few did.
    positive: results.length >= 3 && up.length >= 3 && up.length > down.length + 1,
    good: up.map((r) => ({ text: r.sentence, means: r.means })),
    moved: { up: up.length, down: down.length, steady: steady.length },
  };
}

const monthKey = (d = new Date()) => dateKey(d).slice(0, 7);

/** The note is offered once a month, and only when the month went well. */
export async function shouldShowMonthly(entries, activityLog) {
  if ((await db.getMeta(MONTHLY_META).catch(() => null)) === monthKey()) return null;
  const review = monthlyReview(entries, activityLog);
  return review.positive ? review : null;
}

export async function markMonthlyShown() {
  await db.setMeta(MONTHLY_META, monthKey());
}
