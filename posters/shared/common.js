// deterministic random so every render is identical
let _s = 7; const rnd = () => (_s = (_s * 16807) % 2147483647) / 2147483647;
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

// String of fairy lights along an SVG path. opts: {count, colors, wire, size}
function fairyLights(svg, d, opts = {}) {
  const { count = 22, colors = ['#9BFF6A', '#F4D58D', '#56E39F', '#F7931E', '#C9FF8A'], wire = '#0e1f17', size = 1, glow = .75 } = opts;
  if (!svg.querySelector('#lg')) { const defs = el('defs', {}); const f = el('filter', { id: 'lg', x: '-200%', y: '-200%', width: '500%', height: '500%' }); f.append(el('feGaussianBlur', { stdDeviation: 7 })); defs.append(f); svg.append(defs); }
  const path = el('path', { d, fill: 'none', stroke: wire, 'stroke-width': 2.5 }); svg.append(path);
  const len = path.getTotalLength();
  for (let i = 1; i < count; i++) {
    const p = path.getPointAtLength(len * i / count), c = colors[i % colors.length], z = size;
    svg.append(
      el('circle', { cx: p.x, cy: p.y + 14 * z, r: 16 * z, fill: c, opacity: glow, filter: 'url(#lg)' }),
      el('rect', { x: p.x - 4 * z, y: p.y - 2 * z, width: 8 * z, height: 8 * z, rx: 2, fill: '#1c2b23' }),
      el('ellipse', { cx: p.x, cy: p.y + 14 * z, rx: 6 * z, ry: 9 * z, fill: c }),
      el('ellipse', { cx: p.x - 2 * z, cy: p.y + 11 * z, rx: 2 * z, ry: 3.5 * z, fill: '#fff', opacity: .7 }));
  }
}
function bokeh(box, n, colors, area = [0, 0, 1080, 1350], op = [.25, .35]) {
  for (let i = 0; i < n; i++) {
    const d = 30 + rnd() * 90, e = document.createElement('i');
    Object.assign(e.style, { width: d + 'px', height: d + 'px', left: area[0] + rnd() * area[2] - d / 2 + 'px', top: area[1] + rnd() * area[3] - d / 2 + 'px', background: colors[i % colors.length], opacity: op[0] + rnd() * op[1] });
    box.append(e);
  }
}
function snow(box, n, area = [0, 0, 1080, 1350], color) {
  for (let i = 0; i < n; i++) {
    const d = 1.5 + rnd() * rnd() * 6, e = document.createElement('i');
    Object.assign(e.style, { width: d + 'px', height: d + 'px', left: area[0] + rnd() * area[2] + 'px', top: area[1] + rnd() * area[3] + 'px', opacity: .25 + rnd() * .6, filter: d > 5 ? 'blur(1.5px)' : 'none' });
    if (color) e.style.background = color;
    box.append(e);
  }
}
