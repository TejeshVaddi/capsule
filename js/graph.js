const POS_COLORS = {
  noun: "var(--noun-color, #7B3FA0)",
  verb: "var(--verb-color, #4E6E7E)",
  adjective: "var(--adj-color, #B25BB0)",
  adverb: "var(--adv-color, #8DB3BE)",
  pronoun: "var(--pronoun-color, #5E2542)",
  other: "#9c93ab",
};

/**
 * Renders a compact word-adjacency graph as inline SVG: nodes = words
 * (colored by part of speech), edges = consecutive-word transitions.
 * Uses a simple circular layout, good enough at journal-entry scale.
 */
export function renderWordGraphSVG(metrics, { maxNodes = 16, size = 320 } = {}) {
  const { graph, wordPosMap } = metrics;
  if (!graph || graph.nodeCount === 0) {
    return `<div class="empty-state">Not enough words yet to draw a pattern.</div>`;
  }

  const degree = new Map();
  for (const e of graph.edges) {
    degree.set(e.source, (degree.get(e.source) || 0) + e.weight);
    degree.set(e.target, (degree.get(e.target) || 0) + e.weight);
  }

  const topNodes = [...graph.nodes]
    .sort((a, b) => (degree.get(b) || 0) - (degree.get(a) || 0))
    .slice(0, maxNodes);
  const nodeSet = new Set(topNodes);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  const positions = new Map();
  topNodes.forEach((word, i) => {
    const angle = (2 * Math.PI * i) / topNodes.length - Math.PI / 2;
    positions.set(word, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  });

  const maxWeight = Math.max(1, ...graph.edges.map((e) => e.weight));

  const edgeLines = graph.edges
    .filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target))
    .map((e) => {
      const a = positions.get(e.source);
      const b = positions.get(e.target);
      const opacity = 0.18 + 0.55 * (e.weight / maxWeight);
      const width = 1 + 2.2 * (e.weight / maxWeight);
      return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#4A2E5C" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${width.toFixed(2)}" />`;
    })
    .join("");

  const maxDegree = Math.max(1, ...topNodes.map((w) => degree.get(w) || 1));
  const nodeCircles = topNodes
    .map((word) => {
      const pos = positions.get(word);
      const deg = degree.get(word) || 1;
      const radius = 6 + 8 * (deg / maxDegree);
      const category = wordPosMap[word] || "other";
      const color = POS_COLORS[category] || POS_COLORS.other;
      return `
        <g>
          <circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${color}" fill-opacity="0.92" stroke="#F3EFFB" stroke-width="2" />
          <text x="${pos.x.toFixed(1)}" y="${(pos.y - radius - 6).toFixed(1)}" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" fill="#211A2E" font-weight="600">${escapeXml(word)}</text>
        </g>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${size} ${size}" width="100%" height="${size}" role="img" aria-label="Word pattern graph">
      ${edgeLines}
      ${nodeCircles}
    </svg>`;
}

export function wordGraphLegendHTML() {
  const items = [
    ["Noun", POS_COLORS.noun],
    ["Verb", POS_COLORS.verb],
    ["Adjective", POS_COLORS.adjective],
    ["Adverb", POS_COLORS.adverb],
    ["Pronoun", POS_COLORS.pronoun],
  ];
  return `<div class="word-graph-legend">${items
    .map(([label, color]) => `<span><span class="legend-dot" style="background:${color}"></span>${label}</span>`)
    .join("")}</div>`;
}

function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[c]));
}
