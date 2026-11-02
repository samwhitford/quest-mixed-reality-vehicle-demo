import brunoTruckSvg from "./Silhouettes/bruno_truck.svg?raw";

const brunoTruckInner = brunoTruckSvg
  .replace(/^\s*<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

// Unavailable vehicles show a padlock (coloured to match the dimmed
// "UNAVAILABLE" palette) instead of a body silhouette.
const PADLOCK = `
  <g>
    <path
      d="M 42 58 L 42 40 A 18 18 0 0 1 78 40 L 78 58"
      fill="none"
      stroke="#8a9296"
      stroke-width="10"
      stroke-linecap="round"
    />
    <rect x="30" y="56" width="60" height="46" rx="10" fill="#8a9296" />
    <circle cx="60" cy="76" r="6.5" fill="#3a4145" />
    <rect x="56.5" y="78" width="7" height="14" rx="3.5" fill="#3a4145" />
  </g>
`;

export const SILHOUETTES = {
  truck: {
    viewBox: "0 0 998 1000",
    inner: brunoTruckInner,
  },
  sedan: {
    viewBox: "0 0 120 120",
    inner: PADLOCK,
  },
  coupe: {
    viewBox: "0 0 384 150",
    body:
      "M 16 108 L 16 92 L 66 82 L 118 50 L 192 44 L 262 62 L 322 84 L 368 92 L 372 108 Z",
    wheels: [
      [100, 120, 25],
      [292, 120, 25],
    ],
  },
  van: {
    viewBox: "0 0 120 120",
    inner: PADLOCK,
  },
};
