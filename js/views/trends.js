import { db } from "../data.js";
import { icon } from "../icons.js";
import {
  METRIC_DEFS,
  metricSeriesFromEntries,
  recallDetailSeries,
  renderTrendChart,
  destroyCharts,
  generateTrendNotes,
} from "../charts.js";
import { escapeHtml, el } from "../ui.js";

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
        <p class="muted">
          ${journals.length} journal entr${journals.length === 1 ? "y" : "ies"}${recalls.length ? ` and ${recalls.length} memory visit${recalls.length === 1 ? "" : "s"}` : ""}, compared only to your own history.
        </p>
        <div data-slot="notes"></div>
      </div>
      <div class="grid grid-2" data-slot="charts"></div>
    </div>
  `);
  root.appendChild(panel);

  const notesWrap = panel.querySelector('[data-slot="notes"]');
  if (notes.length) {
    notesWrap.innerHTML = `
      <h3 style="margin-bottom:8px;">What's changed</h3>
      <div class="stack" style="gap:10px;">
        ${notes.map((n) => `<div class="trend-note">${escapeHtml(n)}</div>`).join("")}
      </div>
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
        <div class="section-title" style="margin-bottom:6px;">
          <strong>${escapeHtml(def.label)}</strong>
          ${def.researchBacked ? "" : `<span class="pill" title="Tracked by Capsule; not a research-validated measure">app metric</span>`}
        </div>
        <div class="chart-wrap"><canvas></canvas></div>
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
        <div class="section-title" style="margin-bottom:6px;">
          <strong>Recall detail (memory visits)</strong>
          <span class="pill pill-yellow">recall</span>
        </div>
        <div class="chart-wrap"><canvas></canvas></div>
      </div>
    `);
    chartsWrap.appendChild(card);
    renderTrendChart(card.querySelector("canvas"), recallSeries, "Recall detail", "#4483B0");
  }
}
