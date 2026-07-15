// Single source of canvas colors — mirrors the CSS tokens so canvas & CSS never drift.
// Sampled from memmory.vercel.app (see .claude/skills/visual-style/SKILL.md).

export const CLASS_COLORS = {
  Friends: '#ECB890',
  Family: '#D29DAE',
  Travel: '#9DB4DE',
  Work: '#62C088',
  Milestones: '#C79BCB',
};

export const CLASS_FILLS = {
  Friends: 'rgba(236,176,132,0.16)',
  Family: 'rgba(214,150,170,0.16)',
  Travel: 'rgba(125,155,212,0.16)',
  Work: 'rgba(70,170,112,0.15)',
  Milestones: 'rgba(190,130,200,0.17)',
};

export const CLASS_BORDERS = {
  Friends: 'rgba(240,190,155,0.34)',
  Family: 'rgba(224,165,182,0.34)',
  Travel: 'rgba(150,175,225,0.32)',
  Work: 'rgba(95,190,135,0.34)',
  Milestones: 'rgba(205,150,210,0.34)',
};

export const DAWN = ['#9DB4DE', '#ECB890', '#C79BCB'];
export const DAWN_SAT = ['#5681CC', '#E68A45', '#A451BE'];
export const PAPER = '#F2F0EC';
export const PEACH = '#F5D6BC';
