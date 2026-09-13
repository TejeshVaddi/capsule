// Trend charts and the honest plain-language summary.
//
// Ethical constraints (deliberate, do not "improve" away):
//  - Trends compare the person ONLY to their own history.
//  - Notes state what changed, factually, whatever the direction.
//  - No diagnosis, no disease benchmarks, no promises that anything will improve.

import { VOCAB_POOL_SIZE, pooledVocabSeries } from "./analysis.js?v=611e55e30f";
import { comparableRecalls } from "./recall.js?v=611e55e30f";

export const METRIC_DEFS = [
  { key: "wordCount", label: "Entry length (words)", researchBacked: true, format: (v) => Math.round(v) },
  { key: "nounRate", label: "Noun share of content words", researchBacked: true, format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: "pronounRate", label: "Pronoun share of content words", researchBacked: true, format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: "adverbRate", label: "Adverb share of content words", researchBacked: true, format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: "vocabRichness", label: "Vocabulary variety", researchBacked: true, pooled: true,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    note: `Measured across your last ${VOCAB_POOL_SIZE} entries together, not one at a time. A single short entry does not contain enough words to judge variety fairly, so this line begins once you have ${VOCAB_POOL_SIZE} entries.` },
  { key: "graphDensity", label: "Word-graph connectedness", researchBacked: true, format: (v) => v.toFixed(3) },
  { key: "graphRepetition", label: "Word-graph repetition (mean edge weight)", researchBacked: true, format: (v) => v.toFixed(2) },
  { key: "graphHub", label: "Word-graph hub strength (max in-degree)", researchBacked: true, format: (v) => Math.round(v) },
  { key: "disfluencyRate", label: "Hesitations per 100 words", researchBacked: false, format: (v) => v.toFixed(1) },
];

export function metricSeriesFromEntries(entries, key) {
  // Vocabulary variety is pooled across entries, because a single one is too
  // short to measure. See pooledVocabSeries for why.
  if (key === "vocabRichness") return pooledVocabSeries(entries);

  return entries
    .filter((e) => e.metrics)
    .map((e) => {
      let value;
      if (key === "graphDensity") value = e.metrics.graph?.density;
      else if (key === "graphRepetition") value = e.metrics.graph?.meanEdgeWeight;
      else if (key === "graphHub") value = e.metrics.graph?.maxInDegree;
      else value = e.metrics[key];
      return { date: e.date, value };
    })
    .filter((p) => typeof p.value === "number" && !Number.isNaN(p.value));
}

export function recallDetailSeries(entries) {
  return comparableRecalls(entries.filter((e) => e.type === "recall" && e.recallComparison))
    .map((e) => ({
      date: e.date,
      value: e.recallComparison.recallWordCount + e.recallComparison.recallDistinctContentWords,
      overlapRatio: e.recallComparison.overlapRatio,
    }));
}

let chartInstances = [];

export function destroyCharts() {
  for (const c of chartInstances) c.destroy();
  chartInstances = [];
}

export function renderTrendChart(canvas, series, label, color = "#4A2E5C") {
  const labels = series.map((p) =>
    new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  );
  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data: series.map((p) => p.value),
          borderColor: color,
          backgroundColor: "rgba(74, 46, 92, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: color,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#211A2E",
          titleFont: { family: "Inter", size: 14 },
          bodyFont: { family: "Inter", size: 14 },
        },
      },
      scales: {
        x: {
          ticks: { font: { family: "Inter", size: 13 }, color: "#211A2E" },
          grid: { color: "rgba(74,46,92,0.08)" },
        },
        y: {
          ticks: { font: { family: "Inter", size: 13 }, color: "#211A2E" },
          grid: { color: "rgba(74,46,92,0.08)" },
          beginAtZero: true,
        },
      },
    },
  });
  chartInstances.push(chart);
  return chart;
}

/**
 * Splits a series into an earlier half and a recent half and compares means.
 * Returns null when there isn't enough data to say anything meaningful.
 */
function halfComparison(series, minPoints = 4) {
  if (series.length < minPoints) return null;
  const mid = Math.floor(series.length / 2);
  const earlier = series.slice(0, mid).map((p) => p.value);
  const recent = series.slice(mid).map((p) => p.value);
  // Trimmed means: each half drops its single highest and lowest entry when
  // it has enough to spare. One unusual day is not a trend, and without
  // this a single stumble in an otherwise clean month read as "more pauses
  // than before".
  const trim = (arr) => (arr.length >= 5 ? [...arr].sort((a, b) => a - b).slice(1, -1) : arr);
  const mean = (arr) => { const t = trim(arr); return t.reduce((a, b) => a + b, 0) / t.length; };
  const earlierMean = mean(earlier);
  const recentMean = mean(recent);
  if (earlierMean === 0 && recentMean === 0) return null;
  const base = Math.max(Math.abs(earlierMean), 1e-9);
  const relChange = (recentMean - earlierMean) / base;
  return { earlierMean, recentMean, relChange };
}

const CHANGE_THRESHOLD = 0.15;

/**
 * Generates neutral, factual, non-diagnostic notes about the person's own
 * trends. Direction is reported honestly whichever way it goes.
 */
export function generateTrendNotes(journalEntries, recallEntries) {
  const notes = [];

  const spanDays = journalEntries.length >= 2
    ? Math.round(
        (new Date(journalEntries[journalEntries.length - 1].date) - new Date(journalEntries[0].date)) /
          (24 * 60 * 60 * 1000)
      )
    : 0;
  const spanPhrase =
    spanDays >= 60 ? "over the past couple of months"
    : spanDays >= 25 ? "over the past month"
    : spanDays >= 10 ? "over the past few weeks"
    : "across your recent entries";

  const observations = [
    {
      key: "wordCount",
      shorter: `Your entries have gotten shorter ${spanPhrase}.`,
      longer: `Your entries have gotten longer ${spanPhrase}.`,
      steady: `The length of your entries has stayed steady ${spanPhrase}.`,
    },
    {
      key: "nounRate",
      shorter: `Your entries are using fewer specific naming words (nouns) than they used to.`,
      longer: `Your entries are using more specific naming words (nouns) than they used to.`,
      steady: `Your use of specific naming words has stayed steady.`,
    },
    {
      key: "pronounRate",
      shorter: `Your entries are using fewer general words like "it" and "they" than before.`,
      longer: `Your entries are using more general words like "it" and "they" in place of specific names.`,
      steady: null,
    },
    {
      key: "vocabRichness",
      shorter: `The variety of words in your entries has narrowed ${spanPhrase}.`,
      longer: `The variety of words in your entries has grown ${spanPhrase}.`,
      steady: `The variety of words in your entries has stayed steady.`,
    },
    {
      key: "disfluencyRate",
      shorter: `You've been pausing and repeating words less often than before.`,
      longer: `You've been pausing ("um", "uh") and repeating words more often than before.`,
      steady: null,
    },
  ];

  for (const obs of observations) {
    const series = metricSeriesFromEntries(journalEntries, obs.key);
    const cmp = halfComparison(series);
    if (!cmp) continue;
    if (cmp.relChange <= -CHANGE_THRESHOLD && obs.shorter) notes.push(obs.shorter);
    else if (cmp.relChange >= CHANGE_THRESHOLD && obs.longer) notes.push(obs.longer);
    else if (obs.steady) notes.push(obs.steady);
  }

  const recallSeries = recallDetailSeries(recallEntries);
  const recallCmp = halfComparison(recallSeries, 3);
  if (recallCmp) {
    if (recallCmp.relChange <= -CHANGE_THRESHOLD) {
      notes.push("Your recall descriptions have been including less detail than your earlier ones.");
    } else if (recallCmp.relChange >= CHANGE_THRESHOLD) {
      notes.push("Your recall descriptions have been including more detail than your earlier ones.");
    } else {
      notes.push("The detail in your recall descriptions has stayed steady.");
    }
  }

  return { notes, spanDays };
}
