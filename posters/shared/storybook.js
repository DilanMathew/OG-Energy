// Storybook drawing helpers (needs common.js for el/rnd).
function wobbleDefs(svg, scale = 4) {
  const d = el('defs', {}); const f = el('filter', { id: 'wobble' });
  f.append(el('feTurbulence', { type: 'fractalNoise', baseFrequency: .035, numOctaves: 2, seed: 4 }), el('feDisplacementMap', { in: 'SourceGraphic', scale }));
  const b = el('filter', { id: 'soft', x: '-50%', y: '-50%', width: '200%', height: '200%' }); b.append(el('feGaussianBlur', { stdDeviation: 18 }));
  d.append(f, b); svg.append(d);
}
function starPath(cx, cy, r, rot = 0, inner = .45) {
  let d = ''; for (let i = 0; i < 10; i++) { const a = (i * 36 + rot - 90) * Math.PI / 180, rr = i % 2 ? r * inner : r; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); }
  return d + 'Z';
}
function star(g, cx, cy, r, fill, rot = 0, ink = '#141414', dots = true, sw = 3) {
  g.append(el('path', { d: starPath(cx, cy, r, rot), fill, stroke: ink, 'stroke-width': sw, 'stroke-linejoin': 'round' }));
  if (dots) for (let i = 0; i < 4; i++) { const a = (i * 90 + rot + 18) * Math.PI / 180; g.append(el('circle', { cx: cx + Math.cos(a) * r * 1.4, cy: cy + Math.sin(a) * r * 1.4, r: 2.6, fill: ink })); }
}
function twinkle(g, cx, cy, r, fill) { // 4-point sparkle
  g.append(el('path', { d: `M${cx} ${cy - r} Q ${cx + r * .18} ${cy - r * .18} ${cx + r} ${cy} Q ${cx + r * .18} ${cy + r * .18} ${cx} ${cy + r} Q ${cx - r * .18} ${cy + r * .18} ${cx - r} ${cy} Q ${cx - r * .18} ${cy - r * .18} ${cx} ${cy - r} Z`, fill }));
}
// layered storybook pine; snow = draw snow caps on tiers
function pine(g, x, y, h, fill, ink, snow) {
  const tiers = 4, w = h * .55;
  g.append(el('rect', { x: x - h * .03, y: y - h * .08, width: h * .06, height: h * .1, fill: '#3b2412', stroke: ink, 'stroke-width': 2 }));
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers, top = y - h + t0 * h * .78, bot = y - h * .08 - (tiers - 1 - i) * h * .17, half = w * (.35 + .65 * (i + 1) / tiers) / 2;
    const d = `M${x} ${top} L${x + half * .55} ${(top + bot) / 2} L${x + half * .4} ${(top + bot) / 2} L${x + half} ${bot} Q ${x} ${bot + h * .03} ${x - half} ${bot} L${x - half * .4} ${(top + bot) / 2} L${x - half * .55} ${(top + bot) / 2} Z`;
    g.append(el('path', { d, fill, stroke: ink, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    if (snow) g.append(el('path', { d: `M${x - half * .8} ${bot - 2} Q ${x - half * .4} ${bot + 4} ${x} ${bot - 1} Q ${x + half * .4} ${bot + 5} ${x + half * .85} ${bot - 2}`, fill: 'none', stroke: snow, 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
  }
}
function snowflake(g, cx, cy, r, stroke, sw = 2) {
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r;
    g.append(el('line', { x1: cx, y1: cy, x2: ex, y2: ey, stroke, 'stroke-width': sw, 'stroke-linecap': 'round' }));
    const mx = cx + Math.cos(a) * r * .6, my = cy + Math.sin(a) * r * .6;
    for (const s of [-1, 1]) { const b = a + s * .7; g.append(el('line', { x1: mx, y1: my, x2: mx + Math.cos(b) * r * .32, y2: my + Math.sin(b) * r * .32, stroke, 'stroke-width': sw, 'stroke-linecap': 'round' })); }
  }
}
function gift(g, x, y, w, h, c, rib, ink, rot = 0) {
  const k = el('g', { transform: `rotate(${rot} ${x + w / 2} ${y + h})` });
  k.append(el('rect', { x, y, width: w, height: h, fill: c, stroke: ink, 'stroke-width': 3, rx: 3 }),
    el('rect', { x: x + w / 2 - 6, y, width: 12, height: h, fill: rib, stroke: ink, 'stroke-width': 2 }),
    el('rect', { x: x - 4, y: y - 12, width: w + 8, height: 16, fill: c, stroke: ink, 'stroke-width': 3, rx: 3 }),
    el('path', { d: `M${x + w / 2} ${y - 12} c -18 -22 -34 -6 -18 2 z M${x + w / 2} ${y - 12} c 18 -22 34 -6 18 2 z`, fill: rib, stroke: ink, 'stroke-width': 2.5 }));
  g.append(k);
}
const OFFERS = {
  two: [['Buy 2 Whey', '56 sachets', '7,600', '6,999', '#F7931E'], ['Buy 2 Yeast', '56 sachets', '5,600', '4,999', '#6aa630'], ['Buy 2 Creatine', '2 × 120g tubs', '1,600', '1,399', '#e2372b']],
  combo: [['Whey + Creatine', '4,600', '3,999'], ['Yeast + Creatine', '3,600', '2,999']]
};
function renderOffers(box) {
  box.innerHTML = '<div class="sb-row sb-r3">' + OFFERS.two.map(([t, n, w, p, a]) =>
    `<div class="sb-o" style="--a:${a}"><span class="t">${t}</span><div class="n">${n}</div><span class="was">₹${w}</span><div class="pr"><sup>₹</sup>${p}</div></div>`).join('') +
    '</div><div class="sb-row sb-r2">' + OFFERS.combo.map(([n, w, p]) =>
    `<div class="sb-o c"><div><span class="t">Combo</span><div class="n">${n}</div></div><div class="pr"><span class="was">₹${w}</span><sup>₹</sup>${p}</div></div>`).join('') + '</div>';
}
