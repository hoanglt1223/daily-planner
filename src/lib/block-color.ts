/**
 * Deterministic color from a string. Used to color time blocks by title
 * so the same recurring task looks the same every day.
 */
const PALETTE = [
  { bg: 'bg-sky-100',     border: 'border-sky-400',     fg: 'text-sky-900',     accent: 'bg-sky-500' },
  { bg: 'bg-violet-100',  border: 'border-violet-400',  fg: 'text-violet-900',  accent: 'bg-violet-500' },
  { bg: 'bg-emerald-100', border: 'border-emerald-400', fg: 'text-emerald-900', accent: 'bg-emerald-500' },
  { bg: 'bg-amber-100',   border: 'border-amber-400',   fg: 'text-amber-900',   accent: 'bg-amber-500' },
  { bg: 'bg-cyan-100',    border: 'border-cyan-400',    fg: 'text-cyan-900',    accent: 'bg-cyan-500' },
  { bg: 'bg-indigo-100',  border: 'border-indigo-400',  fg: 'text-indigo-900',  accent: 'bg-indigo-500' },
  { bg: 'bg-teal-100',    border: 'border-teal-400',    fg: 'text-teal-900',    accent: 'bg-teal-500' },
  { bg: 'bg-fuchsia-100', border: 'border-fuchsia-400', fg: 'text-fuchsia-900', accent: 'bg-fuchsia-500' },
];

export function blockColor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
