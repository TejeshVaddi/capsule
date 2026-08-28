// Single source for all iconography. Everything is inline SVG (stroke:
// currentColor) so icons inherit text color and need no image requests.

export const LOGO_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Capsule logo">
  <g fill="none" stroke="#4A2E5C" stroke-linecap="round">
    <path d="M 30 32 A 33 33 0 1 0 45 80" stroke-width="7"/>
    <path d="M 56 15 A 40 40 0 0 0 30 32" stroke-width="7"/>
    <path d="M 45 80 A 42 42 0 0 0 74 79" stroke-width="5"/>
    <line x1="56" y1="15" x2="72" y2="37" stroke-width="3.5"/>
    <line x1="30" y1="32" x2="55" y2="63" stroke-width="3.5"/>
    <line x1="72" y1="37" x2="55" y2="63" stroke-width="3.5"/>
    <line x1="55" y1="63" x2="45" y2="80" stroke-width="3.5"/>
    <line x1="55" y1="63" x2="74" y2="79" stroke-width="3.5"/>
  </g>
  <g fill="#4A2E5C">
    <circle cx="56" cy="15" r="7"/>
    <circle cx="30" cy="32" r="9.5"/>
    <circle cx="72" cy="37" r="6"/>
    <circle cx="55" cy="63" r="6.5"/>
    <circle cx="45" cy="80" r="9.5"/>
    <circle cx="74" cy="79" r="7"/>
  </g>
</svg>`;

const stroke = (paths, viewBox = "0 0 24 24") =>
  `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  home: stroke(`<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5"/>`),
  pencil: stroke(`<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`),
  clock: stroke(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>`),
  star: stroke(`<path d="M12 2.5l2.9 5.9 6.6 1-4.7 4.6 1.1 6.5-5.9-3.1-5.9 3.1 1.1-6.5L2.5 9.4l6.6-1Z"/>`),
  trend: stroke(`<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>`),
  book: stroke(`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>`),
  user: stroke(`<circle cx="12" cy="8" r="4.5"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>`),
  mic: stroke(`<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/>`),
  camera: stroke(`<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="14" r="4"/>`),
  download: stroke(`<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>`),
  upload: stroke(`<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 21h16"/>`),
  mail: stroke(`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>`),
  check: stroke(`<path d="m4 12.5 5.5 5.5L20 6.5"/>`),
  sprout: stroke(`<path d="M12 22v-8"/><path d="M12 14c0-4.5-3.5-8-8-8 0 4.5 3.5 8 8 8Z"/><path d="M12 12c0-3.5 2.7-6 6-6 0 3.5-2.7 6-6 6Z"/>`),
  signOut: stroke(`<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>`),
  cloud: stroke(`<path d="M17.5 19a4.5 4.5 0 0 0 .4-9A7 7 0 0 0 4.3 12.5 4 4 0 0 0 6 19.9Z"/>`),
  device: stroke(`<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>`),
  graph: stroke(`<circle cx="5" cy="6" r="2.2"/><circle cx="18" cy="4.5" r="2.2"/><circle cx="12" cy="13" r="2.2"/><circle cx="5.5" cy="19" r="2.2"/><circle cx="19" cy="18.5" r="2.2"/><path d="M6.8 7.4 10.5 11.3"/><path d="M16.5 6 13.3 11.2"/><path d="M10.7 14.8 7 17.5"/><path d="M13.9 14.5 17.2 17.2"/>`),
};

/** Returns a wrapper span so callers can size icons via CSS (.icon svg). */
export function icon(name, className = "icon") {
  return `<span class="${className}">${ICONS[name] || ""}</span>`;
}

export const LOGO_DATA_URI = "data:image/svg+xml," + encodeURIComponent(LOGO_SVG.trim());
