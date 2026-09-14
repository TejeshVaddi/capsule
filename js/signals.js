// Compares a person's recent entries to their earlier ones and reports which
// patterns have shifted. Used only to order the activity list.
//
// Windows, not single entries: comparing one latest entry to a running average
// is too noisy, since a single tired or busy day trips a flag. This takes 7
// recent entries against the 14 before them, and only reports a shift that is
// both proportionally large AND larger than the person's own day-to-day spread.

import { pooledVocabSeries } from "./analysis.js?v=584f5e5ecb";
import { comparableRecalls } from "./recall.js?v=584f5e5ecb";

// Nothing is claimed until there is enough history to claim it from.
export const MIN_HISTORY = 12;
const RECENT_WINDOW = 7;
const BASELINE_WINDOW = 14;

// A shift must clear BOTH bars: a real proportional change, and a change
// bigger than half the person's own spread. The second bar is what stops
// ordinary week-to-week wobble from reading as a trend.
const MIN_REL_CHANGE = 0.15;
const MIN_EFFECT = 0.5;

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}

/** Compares two samples, returning direction and size only if both bars clear. */
function compare(recent, baseline) {
  if (recent.length < 3 || baseline.length < 3) return null;
  const mr = mean(recent);
  const mb = mean(baseline);
  if (mr === null || mb === null || Math.abs(mb) < 1e-9) return null;

  const relChange = (mr - mb) / Math.abs(mb);
  const pooledSd = Math.sqrt((stdev(recent) ** 2 + stdev(baseline) ** 2) / 2);
  const effect = pooledSd > 1e-9 ? Math.abs(mr - mb) / pooledSd : 0;

  if (Math.abs(relChange) < MIN_REL_CHANGE) return null;
  if (effect < MIN_EFFECT) return null;

  return { direction: relChange > 0 ? "up" : "down", relChange, effect, recent: mr, baseline: mb };
}

function seriesOf(entries, get) {
  return entries.map(get).filter((v) => typeof v === "number" && !Number.isNaN(v));
}

/**
 * Reads the person's own history and returns the pattern shifts worth
 * responding to. Empty is the normal, expected result.
 */
export function detectSignals(entries) {
  const journals = entries
    .filter((e) => e.type === "journal" && e.metrics)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (journals.length < MIN_HISTORY) {
    return { ready: false, entriesNeeded: MIN_HISTORY - journals.length, signals: [] };
  }

  const recent = journals.slice(-RECENT_WINDOW);
  const baseline = journals.slice(-(RECENT_WINDOW + BASELINE_WINDOW), -RECENT_WINDOW);
  if (baseline.length < 3) {
    return { ready: false, entriesNeeded: 3 - baseline.length, signals: [] };
  }

  const signals = [];
  const add = (key, cmp, wanted, label) => {
    if (cmp && cmp.direction === wanted) {
      signals.push({ key, label, strength: cmp.effect, ...cmp });
    }
  };

  // Reaching for specific naming words less often than before.
  add("wordFinding",
    compare(seriesOf(recent, (e) => e.metrics.nounRate), seriesOf(baseline, (e) => e.metrics.nounRate)),
    "down", "reaching for specific names");

  // Leaning on general words (it, they, that) in place of specific ones.
  add("specificity",
    compare(seriesOf(recent, (e) => e.metrics.pronounRate), seriesOf(baseline, (e) => e.metrics.pronounRate)),
    "up", "using general words in place of names");

  // Saying less than usual.
  add("elaboration",
    compare(seriesOf(recent, (e) => e.metrics.wordCount), seriesOf(baseline, (e) => e.metrics.wordCount)),
    "down", "entry length");

  // Vocabulary variety, pooled because one entry is far too short to measure.
  const recentVocab = seriesOf(pooledVocabSeries(recent), (p) => p.value);
  const baseVocab = seriesOf(pooledVocabSeries(baseline), (p) => p.value);
  add("variety", compare(recentVocab, baseVocab), "down", "range of words");

  // Circling back to the same words within an entry.
  add("repetition",
    compare(seriesOf(recent, (e) => e.metrics.graph?.meanEdgeWeight),
            seriesOf(baseline, (e) => e.metrics.graph?.meanEdgeWeight)),
    "up", "returning to the same words");

  // Pauses and repeats. Tracked by Capsule, not a research-validated measure,
  // so it is allowed to influence activity choice but is never stated as a
  // finding anywhere in the interface.
  add("fluency",
    compare(seriesOf(recent, (e) => e.metrics.disfluencyRate), seriesOf(baseline, (e) => e.metrics.disfluencyRate)),
    "up", "pauses while speaking");

  // Recall detail, from memory visits rather than journals.
  const recalls = comparableRecalls(entries.filter((e) => e.type === "recall" && e.recallComparison))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (recalls.length >= 6) {
    const half = Math.floor(recalls.length / 2);
    add("recallDetail",
      compare(seriesOf(recalls.slice(half), (e) => e.recallComparison.overlapRatio),
              seriesOf(recalls.slice(0, half), (e) => e.recallComparison.overlapRatio)),
      "down", "detail when looking back");
  }

  // Strongest first, and capped. A person should never open the app to a
  // list of everything that has changed about them.
  signals.sort((a, b) => b.strength - a.strength);
  return { ready: true, signals: signals.slice(0, 3), allSignals: signals };
}

/**
 * Which activity kinds address a given shift.
 * Ordered best-fit first. An activity is a way to spend time with words,
 * not a treatment, and matching one to a pattern does not change that.
 */
export const SIGNAL_TARGETS = {
  wordFinding: {
    kinds: ["naming", "fluency"],
    because: "Your recent entries have reached for specific naming words less often than they used to.",
    invite: "Read a description, name the thing it describes.",
  },
  specificity: {
    kinds: ["naming", "description"],
    because: "Your recent entries have leaned on general words like \"it\" and \"they\" more than before.",
    invite: "Read a description, name the thing it describes.",
  },
  elaboration: {
    kinds: ["description", "photo-story", "music"],
    because: "Your recent entries have been shorter than they used to be.",
    invite: "A prompt to describe something, out loud or typed.",
  },
  variety: {
    kinds: ["fluency", "description"],
    because: "Your recent entries have drawn on a narrower range of words than before.",
    invite: "Name as many things in a category as you can in a minute.",
  },
  repetition: {
    kinds: ["fluency", "naming"],
    because: "Your recent entries have returned to the same words more than they used to.",
    invite: "Name as many things in a category as you can in a minute.",
  },
  fluency: {
    kinds: ["naming", "word-recall"],
    because: "Your recent entries have had more pauses and repeats than before.",
    invite: "Read a description, name the thing it describes.",
  },
  recallDetail: {
    kinds: ["photo-story", "word-recall"],
    because: "Your recent memory visits have carried less detail than earlier ones.",
    invite: "A photo from your journal, and the story behind it.",
  },
};

/** Scores an activity kind against the detected shifts. Higher is a better fit. */
export function scoreForSignals(kind, signals) {
  let score = 0;
  let reason = null;
  signals.forEach((s, i) => {
    const target = SIGNAL_TARGETS[s.key];
    if (!target) return;
    const rank = target.kinds.indexOf(kind);
    if (rank === -1) return;
    // Strongest signal counts most, and being the best-fit kind counts more
    // than being an also-suitable one.
    const weight = (signals.length - i) * (rank === 0 ? 2 : 1) * (1 + s.strength);
    if (weight > score) {
      score = weight;
      reason = { because: target.because, invite: target.invite, key: s.key };
    }
  });
  return { score, reason };
}
