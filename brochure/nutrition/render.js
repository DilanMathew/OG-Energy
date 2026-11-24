const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [file, scale, out, pdf] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1400 }, deviceScaleFactor: Number(scale) });
  await p.goto('file://' + file, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  const n = await p.locator('.page').count();
  for (let i = 1; i <= n; i++) await p.locator('#p' + i).screenshot({ path: path.join(out, `OG-Nutrition-${i}.png`) });
  // overflow check
  console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.page')].map(pg => { const r = pg.getBoundingClientRect(); let m = 0; pg.querySelectorAll('*').forEach(e => { if (getComputedStyle(e).position === 'absolute') return; const q = e.getBoundingClientRect(); m = Math.max(m, q.bottom - r.top); }); return Math.round(m); }))));
  if (pdf === 'pdf') { await p.addStyleTag({ content: '@page{size:1080px 1350px;margin:0} body{background:none} .page{margin:0;page-break-after:always}' });
    await p.pdf({ path: path.join(out, 'OG-Nutrition-Facts.pdf'), width: '1080px', height: '1350px', printBackground: true }); }
  await b.close();
})();
