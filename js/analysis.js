// In-browser speech-pattern analysis using compromise (window.nlp, loaded via CDN).
// All metrics compare a person only to their own history, never to a clinical
// benchmark. Nothing here diagnoses anything.

const FILLER_WORDS = new Set(["um", "uh", "erm", "er", "hmm", "mm", "uhh", "umm"]);

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
  const vocabRichness = wordCount > 0 ? uniqueWords / wordCount : 0;

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
    uniqueWords,
    vocabRichness,
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
    wordCount: 0, uniqueWords: 0, vocabRichness: 0,
    nounCount: 0, verbCount: 0, adjCount: 0, advCount: 0, pronounCount: 0,
    contentWordCount: 0, nounRate: 0, pronounRate: 0, adverbRate: 0,
    disfluencyRate: 0, fillerCount: 0, repeatCount: 0,
    graph: { nodes: [], edges: [], nodeCount: 0, density: 0, meanEdgeWeight: 0, maxInDegree: 0, hubWord: null },
    distinctContentWords: [],
    wordPosMap: {},
  };
}

/** Compares a recall attempt's text against the original entry's text for that same day. */
export function compareRecallToOriginal(recallText, originalText) {
  const recallMetrics = analyzeText(recallText);
  const originalMetrics = analyzeText(originalText);

  const originalSet = new Set(originalMetrics.distinctContentWords);
  const recallSet = new Set(recallMetrics.distinctContentWords);
  let overlap = 0;
  for (const w of recallSet) if (originalSet.has(w)) overlap++;

  const overlapRatio = originalSet.size > 0 ? overlap / originalSet.size : 0;

  return {
    recallWordCount: recallMetrics.wordCount,
    originalWordCount: originalMetrics.wordCount,
    recallDistinctContentWords: recallSet.size,
    originalDistinctContentWords: originalSet.size,
    overlapCount: overlap,
    overlapRatio,
    recallMetrics,
    originalMetrics,
  };
}
