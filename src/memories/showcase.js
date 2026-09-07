export const scenes = {
  default: { persona: 'p5', tab: 'memories', stack: [], sheet: null },
  empty: { persona: 'p3', tab: 'memories', stack: [], sheet: null },
  many: { persona: 'p2', tab: 'memories', stack: [], sheet: null },
  // filter is core's shared shape ({ people, feelings, places, q }); the shell
  // (src/core/showcase.js) hands it to App as the grid's starting filter.
  filtered: { persona: 'p5', tab: 'memories', stack: [], sheet: null, filter: { people: ['p5_marco'] } },
  search: { persona: 'p5', tab: 'memories', stack: [], sheet: null, filter: { q: 'Amsterdam' } },
  'no-match': { persona: 'p5', tab: 'memories', stack: [], sheet: null, filter: { q: 'zzz' } },
}
