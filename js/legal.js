// Shared presentation for the legal documents, so the privacy policy and
// the terms open in the same scrollable modal and stay visually consistent.

/** Opens a legal document in a scrollable modal. Resolves when closed. */
export function openLegalModal(title, bodyHTML) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", title);
    overlay.innerHTML = `
      <div class="glass-panel policy-panel">
        <h2>${title}</h2>
        <div class="policy-scroll">${bodyHTML}</div>
        <button class="btn btn-primary btn-large" data-slot="close">Close</button>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve();
    };
    function onKey(e) { if (e.key === "Escape") close(); }
    overlay.querySelector('[data-slot="close"]').addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    overlay.querySelector('[data-slot="close"]').focus();
  });
}

/** Builds the document body from a section list shared by both documents. */
export function sectionsToHTML(sections, updatedLine) {
  return `
    <p class="policy-updated">${updatedLine}</p>
    ${sections.map((s) => `
      <section class="policy-section${s.important ? " policy-important" : ""}">
        <h3>${s.heading}</h3>
        ${(s.paragraphs || []).map((p) => `<p>${p}</p>`).join("")}
        ${s.list ? `<ul>${s.list.map((li) => `<li>${li}</li>`).join("")}</ul>` : ""}
        ${(s.after || []).map((p) => `<p>${p}</p>`).join("")}
      </section>`).join("")}`;
}
