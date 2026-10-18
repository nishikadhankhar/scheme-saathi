import React from 'react';

// Original line icons: 24x24 grid, round caps and joins, drawn in currentColor.
// 37 from the design system, plus `document` (a paper with no specific kind) and `sun`.
const ICONS = {
  mic: '<rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3.5"/><path d="M8.5 21.5h7"/>',
  'mic-off': '<path d="M15.5 9.5V6a3.5 3.5 0 0 0-6.6-1.6"/><path d="M8.5 9v2.5a3.5 3.5 0 0 0 5.4 2.9"/><path d="M5 11a7 7 0 0 0 11.3 5.5"/><path d="M19 11a7 7 0 0 1-.6 2.8"/><path d="M12 18v3.5"/><path d="M8.5 21.5h7"/><path d="M3 3l18 18"/>',
  speaker: '<path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1.2"/><rect x="14" y="5" width="3.5" height="14" rx="1.2"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
  'arrow-left': '<path d="M19.5 12h-15"/><path d="M10.5 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M9 5l7 7-7 7"/>',
  phone: '<path d="M5 3.5h3.5l1.8 4.6-2.3 1.5a11 11 0 0 0 6.4 6.4l1.5-2.3 4.6 1.8V19a1.8 1.8 0 0 1-1.8 1.8A16.6 16.6 0 0 1 3.2 5.3 1.8 1.8 0 0 1 5 3.5z"/>',
  share: '<path d="M4 19.5l1.3-3.9A8 8 0 1 1 8.4 18.7z"/><path d="M9 11.5h6"/><path d="M12.5 9l2.5 2.5-2.5 2.5"/>',
  'map-pin': '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>',
  'wifi-off': '<path d="M2.5 8.5a14 14 0 0 1 5-2.9"/><path d="M12 5a14 14 0 0 1 9.5 3.5"/><path d="M5.5 12a9 9 0 0 1 4-2.2"/><path d="M14.5 10a9 9 0 0 1 4 2"/><path d="M9 15.5a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/><path d="M3 3l18 18"/>',
  'signal-low': '<path d="M5 19v-3"/><path d="M10 19v-6"/><path d="M15 19v-9" opacity=".3"/><path d="M20 19V6" opacity=".3"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h1M10.5 10h1M14.5 10h1M18 10h-.5M7 14h10"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.3-2.5 4"/><circle cx="12" cy="17.3" r=".6" fill="currentColor"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>',
  person: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5a7 7 0 0 1 14 0"/>',
  office: '<path d="M3 20.5h18"/><path d="M5 20.5V9l7-4.5L19 9v11.5"/><path d="M9 20.5v-5h6v5"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  rupee: '<path d="M7 4.5h10"/><path d="M7 8.5h10"/><path d="M7 4.5h3.5a4 4 0 0 1 0 8H7l7.5 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  aadhaar: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16a3 3 0 0 1 6 0"/><path d="M14 10h4.5M14 13.5h3"/>',
  passbook: '<path d="M5 3.5h11.5a2 2 0 0 1 2 2v15H7a2 2 0 0 1-2-2z"/><path d="M5 18.5a2 2 0 0 1 2-2h11.5"/><path d="M9.5 7.5h5M9.5 7.5h1.6a1.9 1.9 0 0 1 0 3.8H9.5l3.6 3"/><path d="M9.5 9.4h5"/>',
  'land-record': '<path d="M6 2.5h8.5l4 4v15H6z"/><path d="M14.5 2.5v4h4"/><path d="M9 11.5h7v6H9z"/><path d="M12.5 11.5v6M9 14.5h7"/>',
  'ration-card': '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M6.5 13.5h7a3.5 3.5 0 0 1-7 0z"/><path d="M8 11c.5-1.5 1.5-2 2.5-1.5M11 10.5c.3-1.3 1.2-1.8 2-1.4"/><path d="M16 9.5h2.5M16 13h2.5"/>',
  photo: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><circle cx="12" cy="9.5" r="3"/><path d="M7.5 18.5a4.5 4.5 0 0 1 9 0"/>',
  farming: '<path d="M12 21.5V8"/><path d="M12 8c-2.5 0-3.5-2-3.5-4.5C11 3.5 12 5.5 12 8z"/><path d="M12 8c2.5 0 3.5-2 3.5-4.5C13 3.5 12 5.5 12 8z"/><path d="M12 13c-3 0-4.5-2-4.5-4.5 3 0 4.5 2 4.5 4.5z"/><path d="M12 13c3 0 4.5-2 4.5-4.5-3 0-4.5 2-4.5 4.5z"/><path d="M12 18c-3 0-4.5-2-4.5-4.5 3 0 4.5 2 4.5 4.5z"/><path d="M12 18c3 0 4.5-2 4.5-4.5-3 0-4.5 2-4.5 4.5z"/>',
  insurance: '<path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z"/><path d="M12 16.5V10"/><path d="M12 13c-2 0-3-1.3-3-3.2 2 0 3 1.3 3 3.2zM12 12c2 0 3-1.3 3-3.2-2 0-3 1.3-3 3.2z"/>',
  health: '<path d="M12 20.5S3.5 15.5 3.5 9.2A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.5 2.7c0 6.3-8.5 11.3-8.5 11.3z"/><path d="M12 9.5v6M9 12.5h6"/>',
  housing: '<path d="M2.5 11.5L12 4l9.5 7.5"/><path d="M5 9.5v11h14v-11"/><path d="M10 20.5V15h4v5.5"/><path d="M16.5 7V4h2v4.5"/>',
  loans: '<ellipse cx="9.5" cy="6" rx="6" ry="2.5"/><path d="M3.5 6v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6"/><path d="M3.5 10v4c0 1.4 2.7 2.5 6 2.5"/><circle cx="16.5" cy="16" r="5"/><path d="M14.8 14h3.6M14.8 14h1a1.5 1.5 0 0 1 0 3h-1l2.5 2M14.8 15.5h3.6"/>',
  pension: '<circle cx="10" cy="4.5" r="2.2"/><path d="M10 7.5c-1.5 1.2-2 3-2 5l1 2 .5 6.5"/><path d="M8.5 14.5l-2.5 6"/><path d="M10 9.5l3.5 2.5"/><path d="M15.5 10.5v10.5"/><path d="M15.5 10.5c0-1.2 1-2 2.2-2"/>',
  soil: '<path d="M3 15h18"/><path d="M3 18.5h18" opacity=".55"/><path d="M5 21.5h14" opacity=".35"/><path d="M12 15V9"/><path d="M12 10.5C9 10.5 7.5 8.5 7.5 5.5c3 0 4.5 2 4.5 5z"/><path d="M12 9c2.5 0 4-1.6 4-4.2-2.5 0-4 1.6-4 4.2z"/>',
  // additions (not in the 37): a plain paper for unknown documents, and the sun toggle
  document: '<path d="M6 2.5h8.5l4 4v15H6z"/><path d="M14.5 2.5v4h4"/><path d="M9 12h6M9 15.5h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
};

export function Icon({ name, size = 24, stroke = 2.25, className = '' }) {
  const inner = ICONS[name];
  if (!inner) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

/** The mark: a field-green speech bubble holding a turmeric sprout. */
export function SaathiMark({ size = 40 }) {
  const turmeric = { fill: 'var(--turmeric-400)' };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="shrink-0">
      <path
        d="M24 4C12.4 4 4 11.8 4 21.5c0 5.4 2.6 10.2 6.8 13.4L8.5 44l10.3-5.4c1.7.4 3.4.6 5.2.6 11.6 0 20-7.8 20-17.7S35.6 4 24 4z"
        className="ss-fill-field"
      />
      <path d="M24 31V20" strokeWidth="3" strokeLinecap="round" fill="none" style={{ stroke: 'var(--turmeric-400)' }} />
      <path d="M24 21.5c-4.5 0-7-2.8-7-7.5 4.6 0 7 2.8 7 7.5z" style={turmeric} />
      <path d="M24 24c4.2 0 6.6-2.6 6.6-7-4.3 0-6.6 2.6-6.6 7z" style={turmeric} />
    </svg>
  );
}
