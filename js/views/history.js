import { db, isCloudMode } from "../data.js?v=611e55e30f";
import { icon } from "../icons.js?v=611e55e30f";
import { renderWordGraphSVG, wordGraphLegendHTML } from "../graph.js?v=611e55e30f";
import { formatFriendlyDate } from "../recall.js?v=611e55e30f";
import { escapeHtml, el, photoUrl, toast, guideHtml } from "../ui.js?v=611e55e30f";

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
        ${guideHtml("Here is everything you have saved. Tap any entry to read it. Tap Close to fold it away again. You do not need to do anything here.")}
        <p class="muted">${isCloudMode() ? "Saved to your account." : "Stored privately on this device."}</p>
        <div class="button-row">
          <button class="btn btn-secondary" data-slot="export">${icon("download")} Download my data</button>
        </div>
      </div>
      <div class="stack" data-slot="list"></div>
    </div>
  `);
  root.appendChild(panel);

  panel.querySelector('[data-slot="export"]').addEventListener("click", () => exportData(all));

  const list = panel.querySelector('[data-slot="list"]');

  const newestFirst = [...all].reverse();
  for (const entry of newestFirst) {
    const isRecall = entry.type === "recall";
    const preview = entry.text.length > 140 ? entry.text.slice(0, 140) + "..." : entry.text;
    const card = el(`
      <div class="glass-card entry-card" role="button" tabindex="0" aria-expanded="false">
        <div class="section-title space-below-sm">
          <strong>${escapeHtml(formatFriendlyDate(entry.date))}</strong>
          <span class="pill ${isRecall ? "pill-yellow" : "pill-blue"}">${isRecall ? "Memory visit" : "Journal"}</span>
        </div>
        <p class="muted space-above-sm">${escapeHtml(preview)}</p>
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

    // The entry opens right under itself, and closes the same way, so a long
    // list never loses the person's place.
    const toggle = () => {
      const open = card.nextElementSibling?.classList.contains("entry-detail");
      list.querySelectorAll(".entry-detail").forEach((d) => d.remove());
      list.querySelectorAll('.entry-card[aria-expanded="true"]').forEach((c) => c.setAttribute("aria-expanded", "false"));
      if (open) return;
      const detail = el(`<div class="entry-detail"></div>`);
      card.after(detail);
      card.setAttribute("aria-expanded", "true");
      showDetail(detail, entry, () => { toggle(); card.focus(); });
    };
    card.addEventListener("click", toggle);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  }
}

async function showDetail(container, entry, close) {
  const photos = await db.getPhotosForEntry(entry.id);
  const m = entry.metrics;
  const isRecall = entry.type === "recall";

  let original = null;
  if (isRecall && entry.recallOf) original = await db.getEntry(entry.recallOf);

  container.innerHTML = `
    <div class="glass-panel fade-in">
      <button class="btn btn-secondary entry-close" type="button" data-slot="close">Close</button>
      <div class="section-title">
        <h3>${escapeHtml(formatFriendlyDate(entry.date))}</h3>
        <span class="pill ${isRecall ? "pill-yellow" : "pill-blue"}">${isRecall ? "Memory visit" : "Journal"}</span>
      </div>
      <div class="photo-strip" data-slot="photos"></div>
      <p class="lead">${escapeHtml(entry.text)}</p>
      ${original ? `
        <div class="compare-col space-above-sm">
          <span class="pill">The original day (${escapeHtml(formatFriendlyDate(original.date))})</span>
          <p>${escapeHtml(original.text)}</p>
        </div>` : ""}
      ${m ? `
        <div class="grid grid-2 space-above">
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

  container.querySelector('[data-slot="close"]').addEventListener("click", close);

  const strip = container.querySelector('[data-slot="photos"]');
  for (const p of photos) {
    const img = document.createElement("img");
    img.className = "photo-thumb entry-photo";
    img.alt = "Entry photo";
    img.src = photoUrl(p.blob);
    strip.appendChild(img);
  }
  if (!photos.length) strip.remove();

  container.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
