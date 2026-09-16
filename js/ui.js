import { ICONS } from "./icons.js?v=6fe1a667df";

export function toast(message, ms = 3200) {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.4s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 450);
  }, ms);
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function el(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

/* ---------- The guide box ----------
   Every page and every step of an activity opens with one: what to do right
   now, in a sentence or two, naming the exact button to press. It is the one
   place to look when unsure, so it always looks the same. */

/** Markup for a guide box. `step` is an optional label such as "Step 1 of 3". */
export function guideHtml(text, step = "") {
  return `
    <div class="guide" role="note">
      ${step ? `<span class="guide-step">${escapeHtml(step)}</span>` : ""}
      <p class="guide-text">${escapeHtml(text)}</p>
    </div>`;
}

/**
 * Says, right above a button, why pressing it did nothing yet ("Say or type
 * your answer first"). A toast at the bottom of the screen can sit behind the
 * phone's keyboard, and then the button just looks broken.
 */
export function noteAbove(button, message) {
  let note = button.previousElementSibling;
  if (!note || !note.classList.contains("need-note")) {
    note = document.createElement("p");
    note.className = "need-note";
    note.setAttribute("role", "alert");
    button.before(note);
  }
  note.textContent = message;
}

export function clearNoteAbove(button) {
  const note = button.previousElementSibling;
  if (note && note.classList.contains("need-note")) note.remove();
}

const objectUrls = [];

export function photoUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
}

export function revokePhotoUrls() {
  while (objectUrls.length) URL.revokeObjectURL(objectUrls.pop());
}

/**
 * Shared speech-or-type input widget. Renders a mic button (when supported),
 * live status, and a textarea that always works as the typed fallback.
 */
export function createSpeechComposer({ placeholder, SpeechInputClass, speechSupported }) {
  const wrap = el(`
    <div>
      <div class="record-row">
        ${speechSupported
          ? `<button class="mic-btn" type="button" aria-label="Start or stop speaking">${ICONS.mic}</button>
             <span class="mic-status">Tap the microphone and speak, or type below.</span>`
          : `<span class="mic-status">Speech input isn't available in this browser. Typing works just as well.</span>`}
      </div>
      <textarea rows="6" placeholder="${escapeHtml(placeholder)}"></textarea>
    </div>
  `);

  const textarea = wrap.querySelector("textarea");
  const micBtn = wrap.querySelector(".mic-btn");
  const status = wrap.querySelector(".mic-status");

  let baseText = "";

  if (micBtn) {
    const speech = new SpeechInputClass({
      onStart: () => {
        micBtn.classList.add("recording");
        status.textContent = "Listening... tap again to stop.";
        baseText = textarea.value.trim();
      },
      onInterim: (interim) => {
        textarea.value = joinText(baseText, speech.finalText, interim);
      },
      onFinal: (finalText) => {
        textarea.value = joinText(baseText, finalText, "");
      },
      onEnd: () => {
        micBtn.classList.remove("recording");
        status.textContent = "Tap the microphone and speak, or type below.";
      },
      onError: (err) => {
        micBtn.classList.remove("recording");
        if (err === "not-allowed" || err === "service-not-allowed") {
          status.textContent = "Microphone permission was blocked. You can type instead.";
        } else if (err === "no-speech") {
          status.textContent = "Didn't catch that. Try again, or type below.";
        } else {
          status.textContent = "Speech input hit a snag. Typing works just as well.";
        }
      },
    });

    micBtn.addEventListener("click", () => {
      if (speech.recognizing) speech.stop();
      else speech.start();
    });

    wrap.addEventListener("composer-destroy", () => speech.stop());
  }

  return {
    root: wrap,
    getText: () => textarea.value.trim(),
    setText: (t) => { textarea.value = t; },
    destroy: () => wrap.dispatchEvent(new Event("composer-destroy")),
  };
}

function joinText(base, finalText, interim) {
  return [base, finalText, interim].filter(Boolean).join(" ").replace(/\s+/g, " ");
}
