const paths: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  leaf: '<path d="M20 3C7 2 2 7 5 14c3 7 16 5 15-11Z"/><path d="m4 21 11-12M8 16l-1-5m5 1 5 1"/>',
  book: '<path d="M12 6C8 3 4 4 2 5v15c4-2 7-1 10 1 3-2 6-3 10-1V5c-3-1-6-2-10 1Zm0 0v15"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 11 3 3 5-6"/>',
  lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m6 6 3 3m6 6 3 3M6 18l3-3m6-6 3-3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flower: '<path d="M12 20C3 21 1 15 3 12c5-1 9 3 9 8Zm0 0c9 1 11-5 9-8-5-1-9 3-9 8Z" fill="currentColor" opacity=".35"/><path d="M12 16C4 10 8 4 12 2c4 2 8 8 0 14Z" fill="currentColor" opacity=".6"/><path d="M4 21h16"/>',
  cloud: '<path d="M5 17a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 1 11H5Z" fill="currentColor" opacity=".4"/><path d="M7 20h9m-6 3h3"/>',
  sun: '<circle cx="12" cy="12" r="5" fill="currentColor" opacity=".5"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>'
};
// Only static, project-owned SVG paths are inserted here. Never pass user markup.
export function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: paths[name] || paths.leaf }} />;
}
