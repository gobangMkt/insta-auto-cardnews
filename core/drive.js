'use strict';

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { execSync } = require('child_process');

const CLIENT_PATH = path.join(__dirname, 'oauth-client.json');
const TOKEN_PATH = path.join(__dirname, 'oauth-token.json');
const OUTPUT_ROOT = path.join(__dirname, 'output');

const PENDING_FOLDER_NAME = '대기중';
const DONE_FOLDER_NAME = '완료';

async function getAuth() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('토큰 없음. 먼저 실행하세요: node core/auth.js');
    process.exit(1);
  }
  const clientSecret = JSON.parse(fs.readFileSync(CLIENT_PATH));
  const { client_id, client_secret } = clientSecret.installed;
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3333');
  oauth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
  return oauth2Client;
}

async function findFolder(drive, name, parentId) {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({ q, fields: 'files(id,name)' });
  return res.data.files[0] || null;
}

async function listZipFiles(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains '.zip' and trashed=false`,
    fields: 'files(id,name)',
  });
  return res.data.files;
}

async function downloadFile(drive, fileId, destPath) {
  const dest = fs.createWriteStream(destPath);
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return new Promise((resolve, reject) => {
    res.data.pipe(dest);
    res.data.on('error', reject);
    dest.on('finish', resolve);
  });
}

async function findOrCreateFolder(drive, name, parentId) {
  const existing = await findFolder(drive, name, parentId);
  if (existing) return existing;
  const res = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id,name',
  });
  return res.data;
}

async function uploadFile(drive, folderId, filePath) {
  const name = path.basename(filePath);
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType: 'application/zip', body: fs.createReadStream(filePath) },
    fields: 'id',
  });
  return res.data.id;
}

async function moveFile(drive, fileId, newParentId, oldParentId) {
  await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: oldParentId,
    fields: 'id',
  });
}

async function deleteFile(drive, fileId) {
  await drive.files.delete({ fileId });
}

function extractUrlFromZipName(zipName) {
  const name = zipName.replace(/\.zip$/i, '');
  // 신규 형식: [요청자이름]7021  →  https://gobang.kr/contents/7021
  const shortMatch = name.match(/^(?:\[.+?\])?(\d+)$/);
  if (shortMatch) {
    return `https://gobang.kr/contents/${shortMatch[1]}`;
  }
  // 구형 형식 호환: https___gobang.kr_contents_7841
  if (name.startsWith('https___')) {
    return 'https://' + name.slice('https___'.length).replace(/_/g, '/');
  }
  if (name.startsWith('http___')) {
    return 'http://' + name.slice('http___'.length).replace(/_/g, '/');
  }
  return name;
}

function extractRequesterFromZipName(zipName) {
  const match = zipName.match(/^\[(.+?)\]/);
  return match ? match[1] : null;
}

function slugFromUrl(url) {
  const match = url.match(/\/(\d+)/g);
  const id = match ? match[match.length - 1].replace('/', '') : Date.now().toString();
  return id;
}

async function processZip(drive, zipFile, pendingFolderId, doneFolderId) {
  const url = extractUrlFromZipName(zipFile.name);
  const slug = slugFromUrl(url);
  const outputDir = path.join(OUTPUT_ROOT, `${slug}-drive`);
  const imgDir = path.join(outputDir, 'img');
  const tmpZip = path.join(OUTPUT_ROOT, `_tmp_${zipFile.id}.zip`);

  const requester = extractRequesterFromZipName(zipFile.name);
  const contentId = slugFromUrl(url);
  console.log(`\n처리 시작: ${zipFile.name}${requester ? ` (요청자: ${requester})` : ''}`);
  console.log(`  URL: ${url}`);
  console.log(`  출력: ${outputDir}`);

  // 임시 ZIP 다운로드
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  await downloadFile(drive, zipFile.id, tmpZip);

  // ZIP 압축 해제 → img 폴더
  fs.mkdirSync(imgDir, { recursive: true });
  const zip = new AdmZip(tmpZip);
  zip.extractAllTo(imgDir, true);
  fs.unlinkSync(tmpZip);

  const images = fs.readdirSync(imgDir).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  console.log(`  이미지 ${images.length}개 추출됨`);

  // 슬라이드 생성 안내 출력 (Claude가 이 정보를 보고 HTML 생성)
  console.log('\n===== DRIVE_TASK =====');
  console.log(JSON.stringify({
    url,
    slug: `${slug}-drive`,
    outputDir,
    imgDir,
    images: images.map(f => path.join(imgDir, f)),
  }));
  console.log('===== /DRIVE_TASK =====');

  return { url, slug: `${contentId}-drive`, contentId, requester, outputDir, imgDir, images, driveFileId: zipFile.id };
}

async function zipAndUpload(drive, doneFolderId, outputDir, contentId, requester) {
  const pngDir = path.join(outputDir, 'png');
  if (!fs.existsSync(pngDir)) {
    console.log('  PNG 없음 — 업로드 건너뜀');
    return false;
  }
  const prefix = requester ? `[${requester}]` : '';
  const zipName = `${prefix}${contentId}-result.zip`;
  const zipPath = path.join(OUTPUT_ROOT, zipName);
  const zip = new AdmZip();
  const pngs = fs.readdirSync(pngDir).filter(f => f.endsWith('.png'));
  for (const png of pngs) zip.addLocalFile(path.join(pngDir, png));
  zip.writeZip(zipPath);

  await uploadFile(drive, doneFolderId, zipPath);
  fs.unlinkSync(zipPath);
  console.log(`  완료 폴더에 업로드: ${zipName}`);
  return true;
}

(async () => {
  const authClient = await getAuth();
  const drive = google.drive({ version: 'v3', auth: authClient });

  // 공유 드라이브 포함 검색
  const pendingFolder = await findFolder(drive, PENDING_FOLDER_NAME);
  const doneFolder = await findFolder(drive, DONE_FOLDER_NAME);

  if (!pendingFolder) {
    console.error(`"${PENDING_FOLDER_NAME}" 폴더를 찾을 수 없어요.`);
    console.error('Google Drive에 폴더를 만들고 서비스 계정과 공유해주세요:');
    console.error('  cardnews-bot@cardnews-bot.iam.gserviceaccount.com');
    process.exit(1);
  }
  if (!doneFolder) {
    console.error(`"${DONE_FOLDER_NAME}" 폴더를 찾을 수 없어요.`);
    process.exit(1);
  }

  console.log(`대기중 폴더 ID: ${pendingFolder.id}`);
  console.log(`완료 폴더 ID: ${doneFolder.id}`);

  const zipFiles = await listZipFiles(drive, pendingFolder.id);
  if (zipFiles.length === 0) {
    console.log('대기중인 ZIP 파일이 없어요.');
    process.exit(0);
  }

  console.log(`${zipFiles.length}개 발견: ${zipFiles.map(f => f.name).join(', ')}`);

  for (const zipFile of zipFiles) {
    try {
      const task = await processZip(drive, zipFile, pendingFolder.id, doneFolder.id);

      // 슬라이드 HTML은 Claude가 수동 생성 후 extract.js 실행
      // PNG 폴더가 생겼으면 ZIP 업로드
      const pngDir = path.join(task.outputDir, 'png');
      if (fs.existsSync(pngDir) && fs.readdirSync(pngDir).length > 0) {
        const uploaded = await zipAndUpload(drive, doneFolder.id, task.outputDir, task.contentId, task.requester);
        if (uploaded) {
          const doneSubFolder = await findOrCreateFolder(drive, '작업완료', pendingFolder.id);
          await moveFile(drive, zipFile.id, doneSubFolder.id, pendingFolder.id);
          console.log(`  대기중/작업완료 폴더로 이동: ${zipFile.name}`);
        }
      } else {
        console.log('\n  HTML 슬라이드를 생성하고 extract.js를 실행한 뒤');
        console.log('  다시 drive.js를 실행하면 완료 폴더에 업로드돼요.');
      }
    } catch (err) {
      console.error(`  오류: ${zipFile.name}`, err.message);
    }
  }
})().catch(err => { console.error(err); process.exit(1); });
