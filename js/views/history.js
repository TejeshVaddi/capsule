import { db, isCloudMode } from "../data.js";
import { icon } from "../icons.js";
import { renderWordGraphSVG, wordGraphLegendHTML } from "../graph.js";
import { formatFriendlyDate } from "../recall.js";
import { escapeHtml, el, photoUrl, toast } from "../ui.js";

export async function renderHistoryView(root) {
  root.innerHTML = "";

  const all = await db.allEntries();
  if (!all.length) {
    root.appendChild(el(`
      <div class="glass-panel empty-state">
        <div class="empty-icon">${icon("book", "icon-lg")}</div>
        <h2>No entries yet</h2>
        <p>Your journal and memory visits will collect here, newest first.</p>
      </div>
    `));
    return;
  }

  const panel = el(`
    <div class="stack">
      <div class="glass-panel">
        <div class="section-title">
          <h2>Your entries</h2>
          <span class="pill">${all.length} total</span>
        </div>
        <p class="muted">${isCloudMode() ? "Saved to your account." : "Stored privately on this device."} Tap an entry to revisit it.</p>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
          <button class="btn btn-secondary" data-slot="export">${icon("download")} Download my data</button>
        </div>
      </div>
      <div class="stack" data-slot="list"></div>
      <div data-slot="detail"></div>
    </div>
  `);
  root.appendChild(panel);

  panel.querySelector('[data-slot="export"]').addEventListener("click", () => exportData(all));

  const list = panel.querySelector('[data-slot="list"]');
  const detail = panel.querySelector('[data-slot="detail"]');

  const newestFirst = [...all].reverse();
  for (const entry of newestFirst) {
    const isRecall = entry.type === "recall";
    const preview = entry.text.length > 140 ? entry.text.slice(0, 140) + "..." : entry.text;
    const card = el(`
      <div class="glass-card entry-card">
        <div class="section-title" style="margin-bottom:6px;">
          <strong>${escapeHtml(formatFriendlyDate(entry.date))}</strong>
          <span class="pill ${isRecall ? "pill-yellow" : "pill-blue"}">${isRecall ? "Memory visit" : "Journal"}</span>
        </div>
        <p class="muted" style="margin:4px 0 0;">${escapeHtml(preview)}</p>
        <div class="entry-thumbs" data-slot="thumbs"></div>
      </div>
    `);
    list.appendChild(card);

    if (entry.photoIds?.length) {
      db.getPhotosForEntry(entry.id).then((photos) => {
        const thumbs = card.querySelector('[data-slot="thumbs"]');
        for (const p of photos.slice(0, 4)) {
          const img = document.createElement("img");
          img.alt = "Entry photo";
          img.src = photoUrl(p.blob);
          thumbs.appendChild(img);
        }
      });
    }

    card.addEventListener("click", () => showDetail(detail, entry));
  }
}

async function showDetail(container, entry) {
  const photos = await db.getPhotosForEntry(entry.id);
  const m = entry.metrics;
  const isRecall = entry.type === "recall";

  let original = null;
  if (isRecall && entry.recallOf) original = await db.getEntry(entry.recallOf);

  container.innerHTML = `
    <div class="glass-panel" style="animation: fadeUp 0.35s ease;">
      <div class="section-title">
        <h3>${escapeHtml(formatFriendlyDate(entry.date))}</h3>
        <span class="pill ${isRecall ? "pill-yellow" : "pill-blue"}">${isRecall ? "Memory visit" : "Journal"}</span>
      </div>
      <div class="photo-strip" data-slot="photos"></div>
      <p style="font-size:1.1rem;">${escapeHtml(entry.text)}</p>
      ${original ? `
        <div class="compare-col" style="margin-top:10px;">
          <span class="pill">The original day (${escapeHtml(formatFriendlyDate(original.date))})</span>
          <p>${escapeHtml(original.text)}</p>
        </div>` : ""}
      ${m ? `
        <div class="grid grid-2" style="margin-top:14px;">
          <div>
            <div class="metric-row"><span class="metric-name">Words</span><span class="metric-value">${m.wordCount}</span></div>
            <div class="metric-row"><span class="metric-name">Different words</span><span class="metric-value">${m.uniqueWords}</span></div>
            <div class="metric-row"><span class="metric-name">Naming words (nouns)</span><span class="metric-value">${(m.nounRate * 100).toFixed(0)}%</span></div>
            <div class="metric-row"><span class="metric-name">General words (pronouns)</span><span class="metric-value">${(m.pronounRate * 100).toFixed(0)}%</span></div>
            <div class="metric-row"><span class="metric-name">Hesitations / 100 words</span><span class="metric-value">${m.disfluencyRate.toFixed(1)}</span></div>
          </div>
          <div>
            ${renderWordGraphSVG(m, { size: 240 })}
            ${wordGraphLegendHTML()}
          </div>
        </div>` : ""}
    </div>
  `;

  const strip = container.querySelector('[data-slot="photos"]');
  for (const p of photos) {
    const img = document.createElement("img");
    img.className = "photo-thumb";
    img.style.width = "120px";
    img.style.height = "120px";
    img.alt = "Entry photo";
    img.src = photoUrl(p.blob);
    strip.appendChild(img);
  }
  if (!photos.length) strip.remove();

  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

function exportData(entries) {
  try {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "Capsule",
      note: "Personal journaling data. Photos are not included in this export.",
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `capsule-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast("Your data file is downloading.");
  } catch (err) {
    console.error(err);
    toast("Export failed. Please try again.");
  }
}
