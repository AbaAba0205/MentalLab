const strokes: Record<string, string[]> = {
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  ear: ['M8 8a5 5 0 1 1 9 3c-1 2-4 3-4 6a3 3 0 0 1-6 0', 'M10 9a2 2 0 0 1 4 0c0 2-3 2-3 4'],
  nose: ['M12 3c0 5-6 9-5 12 1 2 3 0 5 0s4 2 5 0c1-2-1-4-2-5', 'M9 18c2 2 4 2 6 0'],
  taste: ['M5 3v6c0 5 14 5 14 0V3', 'M7 12v4a5 5 0 0 0 10 0v-4', 'M12 14v5'],
  hand: ['M8 12V5a2 2 0 0 1 4 0v6-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-5-1-7-4l-3-5c-1-2 1-4 3-2l2 2Z'],
  dish: ['M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', 'M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z', 'm3 3 3 3M18 3l3 3'],
  music: ['M9 18V5l11-2v13', 'M9 17c-6-3-8 5-3 5 2 0 3-2 3-5ZM20 15c-6-3-8 5-3 5 2 0 3-2 3-5Z', 'M9 9l11-2'],
  walk: ['M15 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z', 'm10 9 4-1 2 5 4 1M5 14l4-2 2-5M11 13l-2 5-4 4M12 13l4 3v6'],
  book: ['M12 5C7 2 3 4 3 4v16c5-2 9 0 9 0s4-2 9 0V4s-4-2-9 1Zm0 0v15', 'M6 8l3 1M6 12l3 1m6-4 3-1m-3 5 3-1'],
  meal: ['M3 2v7c0 3 6 3 6 0V2M6 2v20M19 2c-5 3-5 12 0 12V2Zm0 12v8'],
  paint: ['M12 3C0 3 0 21 11 21c6 0-1-6 4-6 10 0 9-12-3-12Z', 'M8 7h.01M5 12h.01M10 17h.01M14 6h.01M19 9h.01'],
  sun: ['M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z', 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1'],
  moon: ['M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z', 'M18 3v4m-2-2h4'],
  cloud: ['M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 6 6 0 0 1 0 11Z'],
  wave: ['M2 10c4-10 8 10 12 0s8 0 8 0M2 17c4-10 8 10 12 0s8 0 8 0'],
  heart: ['M12 21 3 12C-3 5 7-2 12 5c5-7 15 0 9 7l-9 9Z'],
  brain: ['M12 5c-4-5-8 0-6 3-5 0-5 7-1 7-1 5 5 7 7 3 2 4 8 2 7-3 4 0 4-7-1-7 2-3-2-8-6-3Zm0 0v13', 'M7 10l3 2m4 3 3-2'],
  leaf: ['M20 3C6 1 1 8 5 16c7 8 17 2 15-13Z', 'M4 22 17 7M9 16l-1-5m5 1 5 1'],
  mail: ['M3 5h18v14H3Z', 'm3 5 9 8 9-8M3 19l6-7m6 0 6 7'],
  camera: ['M3 7h4l2-3h6l2 3h4v13H3Z', 'M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
  story: ['M4 3h16v16H8l-4 3V3Z', 'M8 7h8m-8 4h8m-8 4h5'],
  message: ['M3 4h18v14H8l-5 4V4Z', 'M7 10h.01M12 10h.01M17 10h.01'],
  focus: ['M2 8V2h6m8 0h6v6m0 8v6h-6M8 22H2v-6', 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
  check: ['m5 12 4 4L19 6'],
};

export function PracticeGlyph({ name, className = '' }: { name: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(strokes[name] || strokes.leaf).map((d, i) => <path key={i} d={d} />)}</svg>;
}

export function PracticeLandscape({ category }: { category: string }) {
  return <svg className="practice-landscape" viewBox="0 0 600 160" fill="none" aria-hidden="true">
    <circle cx="453" cy="64" r="38" fill="currentColor" opacity=".15" />
    <circle cx="453" cy="64" r="26" stroke="currentColor" opacity=".35" />
    <path d="M0 133C85 67 170 139 260 117S440 78 600 125V160H0Z" fill="currentColor" opacity=".08" />
    <path d="M0 155C130 100 214 160 340 133S500 126 600 145" stroke="currentColor" opacity=".25" />
    {category === '观察' ? <><path d="M90 65c-25 0-25-30-4-30 3-23 37-25 44-3 27-5 35 32 5 33Z" fill="white" opacity=".9" /><path d="M320 88c-18 0-18-21-3-21 3-17 26-18 32-2 19-3 25 23 4 23Z" fill="white" opacity=".7" /></>
      : category === '智慧心' ? <><circle cx="265" cy="78" r="43" fill="currentColor" opacity=".1" /><circle cx="310" cy="78" r="43" fill="currentColor" opacity=".18" /><path d="m287 55-7 18 13 8-9 20" stroke="currentColor" opacity=".5" strokeWidth="2" /></>
        : category === '描述' ? <><rect x="92" y="25" width="78" height="100" rx="8" fill="white" opacity=".7" transform="rotate(-9 92 25)" /><path d="m106 50 42-7m-38 27 43-7m-39 27 30-5" stroke="currentColor" opacity=".4" strokeWidth="2" /><path d="m260 90 36-36 11 11-36 36-16 4Z" fill="currentColor" opacity=".2" /></>
          : <><path d="M225 128c-48-38-41-70-9-81 27 21 40 51 9 81Zm0 0c48-19 56-42 39-65-28 3-43 31-39 65Z" fill="currentColor" opacity=".25" /><path d="M225 131V75" stroke="currentColor" opacity=".5" /></>}
    <path d="M55 24v10m-5-5h10m473 63v8m-4-4h8M355 23v6m-3-3h6" stroke="currentColor" opacity=".35" />
  </svg>;
}
