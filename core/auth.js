'use strict';

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

const CLIENT_PATH = path.join(__dirname, 'oauth-client.json');
const TOKEN_PATH = path.join(__dirname, 'oauth-token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const clientSecret = JSON.parse(fs.readFileSync(CLIENT_PATH));
const { client_id, client_secret, redirect_uris } = clientSecret.installed;

const oauth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3333');

const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });

console.log('\n브라우저에서 아래 URL을 열어 Google 계정으로 로그인하세요:\n');
console.log(authUrl);
console.log('\n로그인 후 자동으로 토큰이 저장돼요...\n');

const server = http.createServer(async (req, res) => {
  const qs = new url.URL(req.url, 'http://localhost:3333').searchParams;
  const code = qs.get('code');
  if (!code) { res.end('code 없음'); return; }

  res.end('<h2>인증 완료! 이 창을 닫아도 돼요.</h2>');
  server.close();

  const { tokens } = await oauth2Client.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('토큰 저장 완료:', TOKEN_PATH);
  console.log('이제 node core/drive.js 를 실행하세요.');
  process.exit(0);
});

server.listen(3333, () => {
  console.log('localhost:3333 대기 중...');
});
