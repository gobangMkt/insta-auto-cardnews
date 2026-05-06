const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const projectDir = process.argv[2];
if (!projectDir) {
  console.error('사용법: node extract.js output/{슬러그}');
  process.exit(1);
}

const slidesDir = path.join(projectDir, 'slides');
const pngDir = path.join(projectDir, 'png');

if (!fs.existsSync(slidesDir)) {
  console.error(`slides 폴더 없음: ${slidesDir}`);
  process.exit(1);
}

fs.mkdirSync(pngDir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1500, deviceScaleFactor: 2 });

  const files = fs.readdirSync(slidesDir)
    .filter(f => f.endsWith('.html'))
    .sort();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const htmlPath = path.resolve(slidesDir, file);
    const pngPath = path.join(pngDir, file.replace('.html', '.png'));

    await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, i === 0 ? 500 : 150));
    const { dim, overflowPx } = await page.evaluate(() => {
      const c = document.querySelector('.canvas');
      const footer = document.querySelector('.footer');
      const content = document.querySelector('.content-group, .outer');
      const dim = { width: c.offsetWidth, height: c.offsetHeight };
      let overflowPx = null;
      if (footer && content) {
        const footerTop = footer.getBoundingClientRect().top;
        const contentBottom = content.getBoundingClientRect().bottom;
        if (contentBottom > footerTop) overflowPx = Math.ceil(contentBottom - footerTop);
      }
      return { dim, overflowPx };
    });
    await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: dim.width, height: dim.height } });
    if (overflowPx) {
      console.log(`  ⚠️  ${file} — footer 침범 ${overflowPx}px OVERFLOW`);
    } else {
      console.log(`  ✅ ${file.replace('.html', '.png')} (${dim.width}×${dim.height})`);
    }
  }

  await browser.close();
  console.log(`\n output: ${pngDir}`);
})().catch(err => { console.error(err); process.exit(1); });
