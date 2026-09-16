// Persistent legal footer, appended to every screen.
//
// The links are only half the point. The sentence above them states, in
// plain language, what Capsule actually does with a person's information,
// so someone who never opens a policy still knows where they stand.

import { openPrivacyPolicy } from "./privacy.js?v=bad5e1f123";
import { openTerms } from "./terms.js?v=bad5e1f123";
import { isCloudMode } from "./data.js?v=bad5e1f123";
import { LOGO_SVG } from "./icons.js?v=bad5e1f123";

export function renderFooter({ navigate, onDeleteData }) {
  const wrap = document.createElement("footer");
  wrap.className = "app-footer";
  wrap.innerHTML = `
    <p class="footer-statement">
      Capsule asks for one thing: if you sign in, it uses your
      <strong>email address only</strong>, to keep your journal available across your devices.
      ${isCloudMode()
        ? "Your entries and photos are visible to you alone."
        : "Right now nothing leaves this device at all."}
      Nothing is sold, and there is no advertising.
      <button type="button" class="footer-inline-link" data-slot="privacy">Privacy Policy</button>
      <span class="footer-dot">&middot;</span>
      <button type="button" class="footer-inline-link" data-slot="terms">Terms of Service</button>
      <span class="footer-dot">&middot;</span>
      <button type="button" class="footer-inline-link" data-slot="delete">Delete your data</button>
    </p>

    <div class="footer-rule"></div>

    <div class="footer-bar">
      <div class="footer-brand">
        <span class="footer-mark">${LOGO_SVG}</span>
        <span class="footer-name">Capsule</span>
      </div>
      <nav class="footer-links" aria-label="Legal">
        <button type="button" class="footer-link" data-slot="privacy2">Privacy Policy</button>
        <button type="button" class="footer-link" data-slot="terms2">Terms of Service</button>
        <button type="button" class="footer-link" data-slot="delete2">Delete your data</button>
      </nav>
    </div>

    <p class="footer-fineprint">
      A journaling and cognitive-engagement tool. Not a medical device, and it does not diagnose any condition.
    </p>`;

  const bind = (slots, fn) => slots.forEach((s) => {
    const el = wrap.querySelector(`[data-slot="${s}"]`);
    if (el) el.addEventListener("click", fn);
  });

  bind(["privacy", "privacy2"], () => openPrivacyPolicy());
  bind(["terms", "terms2"], () => openTerms());
  bind(["delete", "delete2"], () => onDeleteData(navigate));

  return wrap;
}
