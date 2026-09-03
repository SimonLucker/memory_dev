// Data + Cortex node colors — design-foundation.md v2.4 section 2.1 (data
// scale) and 6.3 (muted-jewel node gradients). Gradient stop values are the
// exact .node.c1-c4 values from design-direction-v2.html; Work gets a fifth
// slate variant derived in the same family. The old green/purple class colors
// are retired.

// Radial gradient per class: [highlight, mid, deep] stops at 0% / 38% / 100%,
// gradient center at 33% / 27% of the node (the renderer paints the small
// specular point and 1px light ring separately).
export const NODE_GRADIENTS = {
  Travel:     ['#DCE6F7', '#8FA9D6', '#3A4E74'], // steel blue (.c1)
  Friends:    ['#F7DCC2', '#D99B62', '#7A4E28'], // copper (.c2)
  Milestones: ['#F0DCEE', '#B98CC0', '#5C3F66'], // mauve (.c3)
  Family:     ['#F3D9DE', '#C793A2', '#6B4550'], // rose (.c4)
  Work:       ['#E2E6EF', '#9AA3B8', '#41485E'], // slate, derived 5th variant
}
// Heat scale, cool to warm. Allowed ONLY for data visualization: Cortex heat
// pill, Profile year grid, node categories. Never on interface chrome.
export const HEAT = ['#C8D4EC', '#E8CFC4', '#F5D6BC', '#ECB890', '#DC8C5E']

// Stable color per person id, drawn from HEAT (spec 6.6.3): a person keeps
// their color across the app, including their Cortex nodes.
export function personColor(id) {
  let h = 0
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return HEAT[h % HEAT.length]
}
