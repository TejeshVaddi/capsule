// In-browser speech-pattern analysis using compromise (window.nlp, loaded via CDN).
// All metrics compare a person only to their own history, never to a clinical
// benchmark. Nothing here diagnoses anything.

const FILLER_WORDS = new Set(["um", "uh", "erm", "er", "hmm", "mm", "uhh", "umm"]);

// Bumped whenever a metric's definition changes, so stored metrics computed
// under an older definition can be recomputed rather than silently compared
// against new ones. Entries keep their original text, so this is lossless.
export const METRICS_VERSION = 3;

// Window for the moving-average type-token ratio, in words.
//
// Chosen by measuring, not convention, and the measurements showed that a
// SINGLE journal entry is simply too short to carry this metric:
//   window 25 -> no real entry (13 to 19 words) is long enough to measure
//   window 12 -> every entry measurable, but separation collapses to ~0.00003,
//                because short windows saturate near 1.0 and stop discriminating
//
// So vocabulary variety is not measured per entry at all. It is measured over
// a pooled run of recent entries (see pooledVocabRichness), which gives enough
// text for a window wide enough to mean something. Per-entry values stay null,
// which is the honest answer to a question the text cannot support.
export const MATTR_WINDOW = 25;

// How many consecutive entries are pooled before measuring variety.
export const VOCAB_POOL_SIZE = 7;

/**
 * Vocabulary variety, measured as a moving-average type-token ratio.
 *
 * The plain ratio (unique / total) cannot be used for this: it falls
 * mechanically as text gets longer, because every extra word is another
 * chance to repeat one already used. In testing against simulated decline
 * that confound was strong enough to INVERT the metric, so shortening
 * entries appeared as richer vocabulary.
 *
 * MATTR takes the ratio inside a fixed-size window, slid across the text,
 * and averages the results. Every measurement covers the same number of
 * words, so length cancels out and two entries of different lengths can
 * honestly be compared.
 *
 * Returns null when there are fewer words than one window. A short entry
 * genuinely does not carry enough evidence, and reporting null is better
 * than reporting a number that only reflects its brevity.
 */
export function movingAverageTTR(tokens, window = MATTR_WINDOW) {
  if (!tokens || tokens.length < window) return null;

  // Rolling frequency map, so this stays linear in the length of the text.
  const counts = new Map();
  let distinct = 0;
  const add = (w) => {
    const n = counts.get(w) || 0;
    counts.set(w, n + 1);
    if (n === 0) distinct++;
  };
  const remove = (w) => {
    const n = counts.get(w);
    if (n === 1) { counts.delete(w); distinct--; }
    else counts.set(w, n - 1);
  };

  for (let i = 0; i < window; i++) add(tokens[i]);
  let sum = distinct / window;
  let windows = 1;

  for (let i = window; i < tokens.length; i++) {
    add(tokens[i]);
    remove(tokens[i - window]);
    sum += distinct / window;
    windows++;
  }

  return sum / windows;
}

function tokenize(text) {
  return (text.match(/[A-Za-z']+/g) || []).map((w) => w.toLowerCase());
}

function posTermsFromCompromise(text) {
  const doc = window.nlp(text);
  const sentences = doc.json({ terms: { tags: true } }) || [];
  const terms = [];
  for (const s of sentences) {
    for (const t of s.terms || []) {
      terms.push({ text: (t.text || "").toLowerCase(), tags: t.tags || [] });
    }
  }
  return terms;
}

function hasTag(term, tag) {
  return term.tags.includes(tag);
}

/** Builds a directed word-adjacency graph from raw token order (not just content words). */
export function buildWordGraph(tokens) {
  const nodes = new Set(tokens);
  const edgeWeights = new Map(); // "a->b" -> count
  const predecessors = new Map(); // word -> Set(predecessor words)

  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (a === b) continue; // immediate repeats are tracked as disfluency, not graph structure
    const key = `${a}->${b}`;
    edgeWeights.set(key, (edgeWeights.get(key) || 0) + 1);
    if (!predecessors.has(b)) predecessors.set(b, new Set());
    predecessors.get(b).add(a);
  }

  const nodeCount = nodes.size;
  const uniqueEdgeCount = edgeWeights.size;
  const maxPossibleEdges = nodeCount > 1 ? nodeCount * (nodeCount - 1) : 0;
  const density = maxPossibleEdges > 0 ? uniqueEdgeCount / maxPossibleEdges : 0;

  let totalWeight = 0;
  for (const w of edgeWeights.values()) totalWeight += w;
  const meanEdgeWeight = uniqueEdgeCount > 0 ? totalWeight / uniqueEdgeCount : 0;

  let maxInDegree = 0;
  let hubWord = null;
  for (const [word, preds] of predecessors.entries()) {
    if (preds.size > maxInDegree) {
      maxInDegree = preds.size;
      hubWord = word;
    }
  }

  return {
    nodes: Array.from(nodes),
    edges: Array.from(edgeWeights.entries()).map(([key, weight]) => {
      const [source, target] = key.split("->");
      return { source, target, weight };
    }),
    nodeCount,
    density,
    meanEdgeWeight,
    maxInDegree,
    hubWord,
  };
}

function countFillersAndRepeats(rawText) {
  const tokens = tokenize(rawText);
  let fillerCount = 0;
  let repeatCount = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (FILLER_WORDS.has(tokens[i])) fillerCount++;
    if (i > 0 && tokens[i] === tokens[i - 1]) repeatCount++;
  }
  return { fillerCount, repeatCount, totalWords: tokens.length };
}

/**
 * Full metric set for one piece of spoken/typed text.
 * Rates are expressed as a share of "content words" (noun+verb+adjective+adverb+pronoun),
 * per the project's research approach.
 */
export function analyzeText(rawText) {
  const text = (rawText || "").trim();
  if (!text) {
    return emptyMetrics();
  }

  const tokens = tokenize(text);
  const wordCount = tokens.length;
  const uniqueWords = new Set(tokens).size;
  // Length-invariant. Null when the entry is too short to measure honestly.
  const vocabRichness = movingAverageTTR(tokens);
  // The raw ratio is kept for reference only. It is NOT charted or trended,
  // because it tracks how long an entry is more than how varied it is.
  const typeTokenRatio = wordCount > 0 ? uniqueWords / wordCount : 0;

  const posTerms = window.nlp ? posTermsFromCompromise(text) : [];
  let nounCount = 0, verbCount = 0, adjCount = 0, advCount = 0, pronounCount = 0;
  for (const term of posTerms) {
    if (hasTag(term, "Noun")) nounCount++;
    if (hasTag(term, "Verb")) verbCount++;
    if (hasTag(term, "Adjective")) adjCount++;
    if (hasTag(term, "Adverb")) advCount++;
    if (hasTag(term, "Pronoun")) pronounCount++;
  }
  const contentWordCount = nounCount + verbCount + adjCount + advCount + pronounCount;
  const nounRate = contentWordCount > 0 ? nounCount / contentWordCount : 0;
  const pronounRate = contentWordCount > 0 ? pronounCount / contentWordCount : 0;
  const adverbRate = contentWordCount > 0 ? advCount / contentWordCount : 0;

  const { fillerCount, repeatCount } = countFillersAndRepeats(text);
  const disfluencyRate = wordCount > 0 ? ((fillerCount + repeatCount) / wordCount) * 100 : 0;

  const graph = buildWordGraph(tokens);

  const distinctContentWords = new Set(
    posTerms
      .filter((t) => hasTag(t, "Noun") || hasTag(t, "Verb") || hasTag(t, "Adjective"))
      .map((t) => t.text)
  );

  const wordPosMap = {};
  for (const term of posTerms) {
    if (wordPosMap[term.text]) continue;
    if (hasTag(term, "Pronoun")) wordPosMap[term.text] = "pronoun";
    else if (hasTag(term, "Noun")) wordPosMap[term.text] = "noun";
    else if (hasTag(term, "Verb")) wordPosMap[term.text] = "verb";
    else if (hasTag(term, "Adjective")) wordPosMap[term.text] = "adjective";
    else if (hasTag(term, "Adverb")) wordPosMap[term.text] = "adverb";
    else wordPosMap[term.text] = "other";
  }

  return {
    wordCount,
    v: METRICS_VERSION,
    uniqueWords,
    vocabRichness,
    typeTokenRatio,
    nounCount,
    verbCount,
    adjCount,
    advCount,
    pronounCount,
    contentWordCount,
    nounRate,
    pronounRate,
    adverbRate,
    disfluencyRate,
    fillerCount,
    repeatCount,
    graph,
    distinctContentWords: Array.from(distinctContentWords),
    wordPosMap,
  };
}

function emptyMetrics() {
  return {
    v: METRICS_VERSION,
    wordCount: 0, uniqueWords: 0, vocabRichness: null, typeTokenRatio: 0,
    nounCount: 0, verbCount: 0, adjCount: 0, advCount: 0, pronounCount: 0,
    contentWordCount: 0, nounRate: 0, pronounRate: 0, adverbRate: 0,
    disfluencyRate: 0, fillerCount: 0, repeatCount: 0,
    graph: { nodes: [], edges: [], nodeCount: 0, density: 0, meanEdgeWeight: 0, maxInDegree: 0, hubWord: null },
    distinctContentWords: [],
    wordPosMap: {},
  };
}

/**
 * Vocabulary variety across a pooled run of entries.
 *
 * One entry of 15 words cannot support this measurement; seven of them can.
 * Pooling trades day-level resolution, which was never real here, for a
 * number that actually moves when vocabulary does.
 *
 * Returns a series of { date, value }, one per entry from the pool-th onward,
 * each measured over that entry and the ones before it.
 */
export function pooledVocabSeries(entries, pool = VOCAB_POOL_SIZE) {
  const withText = entries.filter((e) => e.text).sort((a, b) => new Date(a.date) - new Date(b.date));
  const out = [];
  for (let i = pool - 1; i < withText.length; i++) {
    const slice = withText.slice(i - pool + 1, i + 1);
    const tokens = slice.flatMap((e) => tokenize(e.text));
    const value = movingAverageTTR(tokens);
    if (typeof value === "number") out.push({ date: withText[i].date, value });
  }
  return out;
}

/**
 * Compares a recall attempt's text against the original entry's text for that same day.
 *
 * `hintWords` are words the visit showed as hints. Saying a hint back is not
 * remembering it, so those words are left out of the recalled detail and the
 * shared details, and out of the original's total that sharing is measured
 * against. The original's own detail count is kept whole: it describes the day.
 */
export function compareRecallToOriginal(recallText, originalText, hintWords = []) {
  const recallMetrics = analyzeText(recallText);
  const originalMetrics = analyzeText(originalText);
  const hinted = new Set(hintWords.map((w) => w.toLowerCase()));

  const originalAll = new Set(originalMetrics.distinctContentWords);
  const originalSet = new Set([...originalAll].filter((w) => !hinted.has(w)));
  const recallSet = new Set(recallMetrics.distinctContentWords.filter((w) => !hinted.has(w)));
  let overlap = 0;
  for (const w of recallSet) if (originalSet.has(w)) overlap++;

  const overlapRatio = originalSet.size > 0 ? overlap / originalSet.size : 0;

  return {
    recallWordCount: recallMetrics.wordCount,
    originalWordCount: originalMetrics.wordCount,
    recallDistinctContentWords: recallSet.size,
    originalDistinctContentWords: originalAll.size,
    overlapCount: overlap,
    overlapRatio,
    recallMetrics,
    originalMetrics,
  };
}
