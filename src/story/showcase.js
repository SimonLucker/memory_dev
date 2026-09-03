// Ids from the Isabel seed (data/demo/isabel.json). The *-end scenes scroll to the bottom blocks.
const story = (id, extra = {}) => ({ persona: 'p5', tab: 'home', stack: [{ kind: 'story', id, ...extra }], sheet: null })
export const scenes = {
  default: story('isa_marco'),
  solo: story('isa_marco'),
  'solo-end': { ...story('isa_marco'), shot: ['--scroll', '900'] },
  shared: story('isa_greece'),
  'shared-end': { ...story('isa_greece'), shot: ['--scroll', '900'] },
  'shared-filtered': story('isa_greece', { filter: 'p5_elena' }),
  viewer: { persona: 'p5', tab: 'home', stack: [{ kind: 'story', id: 'isa_greece' }, { kind: 'viewer', id: 'isa_greece', index: 1 }], sheet: null },
}
