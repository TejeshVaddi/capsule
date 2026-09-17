import { db } from "../data.js?v=2fb457af22";
import { icon } from "../icons.js?v=2fb457af22";
import {
  METRIC_DEFS,
  metricSeriesFromEntries,
  recallDetailSeries,
  renderTrendChart,
  destroyCharts,
  generateTrendNotes,
  seriesTrend,
} from "../charts.js?v=2fb457af22";
import { escapeHtml, el, guideHtml } from "../ui.js?v=2fb457af22";
import { buildFocus, weightFor, FOCUS_AREAS, SLOT_NAMES, EVIDENCE_WORDS } from "../focus.js?v=2fb457af22";
import { currentRhythm } from "../rhythm.js?v=2fb457af22";
import { closingLine, TONE_WORDS, CHART_GUIDES, chartDirection, WORK_AREA } from "../meaning.js?v=2fb457af22";

const CHART_COLORS = ["#4A2E5C", "#4483B0", "#7B3FA0", "#4E6E7E", "#B25BB0", "#5E2542", "#8DB3BE", "#4A2E5C", "#4483B0"];

export async function renderTrendsView(root) {
  destroyCharts();
  root.innerHTML = "";

  const all = await db.allEntries();
  const journals = all.filter((e) => e.type === "journal");
  const recalls = all.filter((e) => e.type === "recall");

  if (journals.length < 2) {
    root.appendChild(el(`
      <div class="glass-panel empty-state">
        <div class="empty-icon">${icon("trend", "icon-lg")}</div>
        <h2>Your trends will appear here</h2>
        <p>After a few journal entries, Capsule can start showing how your own patterns move over time.</p>
      </div>
    `));
    return;
  }

  const { notes } = generateTrendNotes(journals, recalls);

  const panel = el(`
    <div class="stack">
      <div class="glass-panel">
        <h2>Your patterns over time</h2>
        ${guideHtml("These charts show how your own entries change over time. You do not need to do anything here. Just look if you want to.")}
        <p class="muted">
          ${journals.length} journal entr${journals.length === 1 ? "y" : "ies"}${recalls.length ? ` and ${recalls.length} memory visit${recalls.length === 1 ? "" : "s"}` : ""}, compared only to your own history.
        </p>
        <div data-slot="notes"></div>
      </div>
      <div data-slot="plan"></div>
      <div class="grid grid-2" data-slot="charts"></div>
    </div>
  `);
  root.appendChild(panel);
  // One focus, used for both the plan and the notes, so what a note says
  // Capsule will do is what the plan below it actually does.
  const focus = buildFocus(all, await db.allActivityLog().catch(() => []), { rhythm: await currentRhythm(all) });
  panel.querySelector('[data-slot="plan"]').appendChild(planCard(focus, all));
  const leaningOn = new Set(focus.top.slice(0, 2));

  const notesWrap = panel.querySelector('[data-slot="notes"]');
  if (notes.length) {
    // Each change says what it means for your entries, and a change that
    // makes looking back harder says what Capsule does about it.
    const counts = { hard: notes.filter((n) => n.tone === "hard").length, good: notes.filter((n) => n.tone === "good").length };
    const closing = closingLine(counts);
    notesWrap.innerHTML = `
      <h3 class="space-below-sm">What's changed</h3>
      <div class="stack stack-tight">
        ${notes.map((n) => `
          <div class="trend-note trend-${escapeHtml(n.tone || "steady")}">
            <span class="trend-verdict">${escapeHtml(TONE_WORDS[n.tone] || TONE_WORDS.steady)}</span>
            <p class="trend-what">${escapeHtml(n.text)}</p>
            ${n.means || n.helps ? `
              <details class="explain">
                <summary>What this means</summary>
                <div class="explain-body">
                  ${n.whatIs ? `<p><span class="explain-tag">What it is</span>${escapeHtml(n.whatIs)}</p>` : ""}
                  ${n.means ? `<p><span class="explain-tag">What the change means</span>${escapeHtml(n.means)}</p>` : ""}
                  ${n.helps ? `<p><span class="explain-tag">Why it is worth it</span>${escapeHtml(n.helps)}</p>` : ""}
                  ${n.work && leaningOn.has(WORK_AREA[n.key]) ? `<p class="trend-work">${escapeHtml(n.work)}</p>` : ""}
                </div>
              </details>` : ""}
          </div>`).join("")}
      </div>
      ${closing ? `<p class="muted space-above-sm">${escapeHtml(closing)}</p>` : ""}
    `;
  } else {
    notesWrap.innerHTML = `<p class="muted">Not enough entries yet for a change summary. It appears after a handful of entries spread over time.</p>`;
  }

  const chartsWrap = panel.querySelector('[data-slot="charts"]');

  METRIC_DEFS.forEach((def, i) => {
    const series = metricSeriesFromEntries(journals, def.key);
    if (series.length < 2) return;
    const card = el(`
      <div class="glass-card">
        <div class="section-title space-below-sm">
          <strong>${escapeHtml(def.label)}</strong>
          ${def.researchBacked ? "" : `<span class="pill" title="Tracked by Capsule; not a research-validated measure">app metric</span>`}
        </div>
        <div class="chart-wrap"><canvas></canvas></div>
        ${chartExplainer(def.key, series)}
        ${def.note ? `<p class="muted chart-note">${escapeHtml(def.note)}</p>` : ""}
      </div>
    `);
    chartsWrap.appendChild(card);
    renderTrendChart(card.querySelector("canvas"), series, def.label, CHART_COLORS[i % CHART_COLORS.length]);
  });

  const recallSeries = recallDetailSeries(recalls);
  if (recallSeries.length >= 2) {
    const card = el(`
      <div class="glass-card">
        <div class="section-title space-below-sm">
          <strong>Recall detail (memory visits)</strong>
          <span class="pill pill-yellow">recall</span>
        </div>
        <div class="chart-wrap"><canvas></canvas></div>
        ${chartExplainer("recallDetail", recallSeries, 3)}
      </div>
    `);
    chartsWrap.appendChild(card);
    renderTrendChart(card.querySelector("canvas"), recallSeries, "Recall detail", "#4483B0");
  }
}

/**
 * How the day's activities are being chosen for this person, in plain words
 * and one bar per kind of activity. Everything comes from their own entries,
 * visits and games (see focus.js), and none of it is presented as a finding.
 */
/**
 * Under each chart: what the line is, how it is worked out, which way is
 * the better direction, and which way it is going for this person. Folded
 * behind the same chevron as everything else on this page.
 */
function chartExplainer(key, series, minPoints = 4) {
  const guide = CHART_GUIDES[key];
  if (!guide) return "";
  const now = chartDirection(key, seriesTrend(series, minPoints));
  const better = guide.betterText
    || (guide.better === "higher" ? "Higher is the better direction on this line."
      : guide.better === "lower" ? "Lower is the better direction on this line."
      : "Neither higher nor lower is better on this line.");
  return `
    <details class="explain">
      <summary>What this chart means</summary>
      <div class="explain-body">
        <p><span class="explain-tag">What it is</span>${escapeHtml(guide.what)}</p>
        <p><span class="explain-tag">How it is measured</span>${escapeHtml(guide.how)}</p>
        <p><span class="explain-tag">Which way is better</span>${escapeHtml(better)}</p>
        ${now ? `<p><span class="explain-tag">Where you are</span>${escapeHtml(now)}</p>` : ""}
        ${guide.note ? `<p class="muted">${escapeHtml(guide.note)}</p>` : ""}
      </div>
    </details>`;
}

function planCard(focus, entries) {
  // Photo stories need a photo; without one they are never offered.
  const hasPhoto = entries.some((e) => e.type === "journal" && e.photoIds?.length);
  const slots = Object.keys(SLOT_NAMES).filter((slot) => slot !== "photo-story" || hasPhoto);
  const sample = (slot) => ["procedural", "scene", "reminiscence", "open"].includes(slot)
    ? { kind: "description", data: { kind: slot } }
    : { kind: slot, data: {} };
  const rows = slots.map((slot) => ({ slot, weight: weightFor(sample(slot), focus, { steady: true }).weight }))
    .sort((a, b) => b.weight - a.weight);
  const most = Math.max(...rows.map((r) => r.weight));

  const areas = focus.top.slice(0, 2);
  const lead = !focus.ready
    ? "Capsule is still getting to know you. Until it has more to go on, every kind of activity gets an equal turn."
    : areas.length
      ? `Right now Capsule gives a little more room to activities for ${areas.map((k) => FOCUS_AREAS[k].label.toLowerCase()).join(" and ")}. It keeps a mix of everything, and it changes as you go.`
      : "Nothing stands out right now, so every kind of activity gets a fair turn, and ones you have not done lately come up first.";
  const easy = [...focus.easy].map((k) => SLOT_NAMES[k]).filter(Boolean);

  // Where each lean came from, in the person's own terms, so the choosing
  // can be checked rather than taken on trust.
  const why = areas.map((key) => {
    const sources = focus.evidence
      .filter((e) => e.area === key)
      .map((e) => EVIDENCE_WORDS[e.source] || e.source)
      .filter((x, i, all) => all.indexOf(x) === i)
      .slice(0, 2);
    if (!sources.length) return null;
    return `<li><strong>${escapeHtml(FOCUS_AREAS[key].label)}:</strong> noticed in ${escapeHtml(sources.join(", and in "))}. These activities are practice at ${escapeHtml(FOCUS_AREAS[key].helps)}.</li>`;
  }).filter(Boolean);

  return el(`
    <div class="glass-panel">
      <h2>How your activities are chosen</h2>
      <p>${escapeHtml(lead)}</p>
      ${why.length ? `<ul class="plan-why">${why.join("")}</ul>` : ""}
      ${easy.length ? `<p class="muted">${escapeHtml(easy.join(" and "))} ${easy.length === 1 ? "has" : "have"} been going very well lately, so ${easy.length === 1 ? "it comes" : "they come"} up a little less.</p>` : ""}
      <div class="plan-bars" role="list">
        ${rows.map((r) => `
          <div class="plan-row" role="listitem">
            <span class="plan-name">${escapeHtml(SLOT_NAMES[r.slot])}</span>
            <span class="plan-track" aria-hidden="true"><span class="plan-fill" style="width:${Math.round((r.weight / most) * 100)}%"></span></span>
          </div>`).join("")}
      </div>
      <p class="muted chart-note">A longer bar means that kind comes up more often. This is worked out only from your own entries, memory visits and games, compared with your own earlier weeks.</p>
    </div>`);
}
