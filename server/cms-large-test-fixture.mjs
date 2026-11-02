import defaults from '../shared/site-defaults.json' with { type: 'json' };

// Valid individual sections below 1 MiB, with a website snapshot above D1's
// 2,000,000-byte row limit. Shared by Node and actual workerd/D1 regression tests.
export function largeWebsiteFixture() {
  const picture = 'https://images.example.test/' + 'a'.repeat(1700);
  return {
    copy: Array.from({ length: 40 }, (_, index) => ({ page: '/', key: index.toString(16).padStart(64,'0'), original: `Field ${index}`, value: 'x'.repeat(20000) })),
    images: Array.from({ length: 200 }, (_, index) => ({ page: '/', key: index.toString(16).padStart(64,'0'), original: `${picture}-${index}.webp`, url: `${picture}-${index}.webp`, alt: 'Slika' })),
    links: [],
    layout: { pages: [{ path: '/', title: 'Naslov', blocks: Array.from({ length: 70 }, (_, index) => ({ id: `block-${index}`, type: 'text', tone: 'plain', align: 'left', width: 'wide', hidden: false, title: '', text: 'y'.repeat(11000), links: [] })) }], navigation: [] },
    settings: structuredClone(defaults.settings),
  };
}
