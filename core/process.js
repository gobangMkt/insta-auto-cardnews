'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const ROOT = path.join(__dirname, '..');
const PENDING_DIR = path.join(ROOT, '대기중');
const DONE_DIR = path.join(ROOT, '완료');
const ARCHIVE_DIR = path.join(PENDING_DIR, '작업완료');
const OUTPUT_ROOT = path.join(__dirname, 'output');

[PENDING_DIR, DONE_DIR, ARCHIVE_DIR, OUTPUT_ROOT].forEach(d => fs.mkdirSync(d, { recursive: true }));

function extractTypeFromZipName(zipName) {
  const name = zipName.replace(/\.zip$/i, '').replace(/^\[.+?\]/, '');
  if (name.startsWith('B-')) return 'B';
  if (name.startsWith('C-')) return 'C';
  return 'A';
}

function extractRequesterFromZipName(zipName) {
  const match = zipName.match(/^\[(.+?)\]/);
  return match ? match[1] : null;
}

function extractUrlFromZipName(zipName) {
  const name = zipName.replace(/\.zip$/i, '').replace(/^\[.+?\]/, '').replace(/^[A-Z]-/, '');
  const shortMatch = name.match(/^(\d+)$/);
  if (shortMatch) return `https://gobang.kr/contents/${shortMatch[1]}`;
  if (name.startsWith('https___')) return 'https://' + name.slice('https___'.length).replace(/_/g, '/');
  if (name.startsWith('http___')) return 'http://' + name.slice('http___'.length).replace(/_/g, '/');
  return name;
}

function slugFromUrl(url) {
  const match = url.match(/\/(\d+)/g);
  const id = match ? match[match.length - 1].replace('/', '') : Date.now().toString();
  return id;
}

function processZip(zipPath) {
  const zipName = path.basename(zipPath);
  const url = extractUrlFromZipName(zipName);
  const slug = slugFromUrl(url);
  const type = extractTypeFromZipName(zipName);
  const requester = extractRequesterFromZipName(zipName);
  const outputDir = path.join(OUTPUT_ROOT, `${slug}-drive`);
  const imgDir = path.join(outputDir, 'img');

  if (fs.existsSync(path.join(outputDir, 'task.json'))) {
    console.log(`\n  ${zipName} — 슬라이드 제작 중, 건너뜀`);
    return;
  }

  console.log(`\n처리 시작: ${zipName}${requester ? ` (요청자: ${requester})` : ''}`);
  console.log(`  URL: ${url}  타입: ${type}`);
  console.log(`  출력: ${outputDir}`);

  fs.mkdirSync(imgDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(imgDir, true);

  const images = fs.readdirSync(imgDir).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  console.log(`  이미지 ${images.length}개 추출됨`);

  fs.writeFileSync(
    path.join(outputDir, 'task.json'),
    JSON.stringify({ url, contentId: slug, requester, type, zipPath }, null, 2)
  );

  console.log('\n===== DRIVE_TASK =====');
  console.log(JSON.stringify({
    url,
    slug: `${slug}-drive`,
    outputDir,
    imgDir,
    images: images.map(f => path.join(imgDir, f)),
    type,
  }));
  console.log('===== /DRIVE_TASK =====');
  console.log('\n  슬라이드 제작 후 process.js 재실행하면 완료 폴더로 이동됩니다.');
}

function finalize() {
  const entries = fs.readdirSync(OUTPUT_ROOT).flatMap(name => {
    const taskPath = path.join(OUTPUT_ROOT, name, 'task.json');
    const pngDir = path.join(OUTPUT_ROOT, name, 'png');
    if (!fs.existsSync(taskPath) || !fs.existsSync(pngDir)) return [];
    const pngs = fs.readdirSync(pngDir).filter(f => f.endsWith('.png')).sort();
    return pngs.length > 0 ? [{ name, pngs }] : [];
  });

  if (entries.length === 0) {
    console.log('완료할 항목 없음.');
    return;
  }

  for (const { name, pngs } of entries) {
    const task = JSON.parse(fs.readFileSync(path.join(OUTPUT_ROOT, name, 'task.json')));
    const prefix = task.requester ? `[${task.requester}]` : '';
    const zipName = `${prefix}${task.contentId}-result.zip`;
    const zipPath = path.join(DONE_DIR, zipName);

    const zip = new AdmZip();
    for (const png of pngs) zip.addLocalFile(path.join(OUTPUT_ROOT, name, 'png', png));
    zip.writeZip(zipPath);
    console.log(`  완료 폴더 저장: ${zipName} (${pngs.length}장)`);

    if (task.zipPath && fs.existsSync(task.zipPath)) {
      fs.renameSync(task.zipPath, path.join(ARCHIVE_DIR, path.basename(task.zipPath)));
      console.log(`  원본 ZIP → 작업완료 이동`);
    }

    fs.unlinkSync(path.join(OUTPUT_ROOT, name, 'task.json'));
  }
}

const zipFiles = fs.readdirSync(PENDING_DIR).filter(f => {
  const full = path.join(PENDING_DIR, f);
  return f.toLowerCase().endsWith('.zip') && fs.statSync(full).isFile();
});

if (zipFiles.length > 0) {
  console.log(`${zipFiles.length}개 발견: ${zipFiles.join(', ')}`);
  for (const f of zipFiles) {
    try { processZip(path.join(PENDING_DIR, f)); }
    catch (err) { console.error(`  오류: ${f}`, err.message); }
  }
}

finalize();
