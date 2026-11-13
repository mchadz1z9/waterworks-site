// Renders card.html to print files. Run: node render-card.js   (needs Playwright)
const { chromium } = require('playwright');
(async () => {
  const dir = __dirname;
  const b = await chromium.launch();
  // 3.75in x 2.25in at 96 css px/in = 360x216; scale 3.125 => 1125x675 px = 300 dpi
  const p = await b.newPage({ viewport: { width: 360, height: 216 }, deviceScaleFactor: 3.125 });
  await p.goto('file://' + dir + '/card.html');
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: '@page{size:3.75in 2.25in;margin:0} body{display:block!important;padding:0!important;background:#fff!important}' });
  await p.locator('#card').screenshot({ path: `${dir}/business-card-300dpi.png` });
  await p.pdf({ path: `${dir}/business-card-print.pdf`, width: '3.75in', height: '2.25in', printBackground: true, pageRanges: '1' });
  await b.close();
})();
