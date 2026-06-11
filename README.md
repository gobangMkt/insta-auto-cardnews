# 시리즈픽 카드뉴스 자동화

gobang.kr 콘텐츠 URL을 넣으면 Claude가 슬라이드 HTML을 만들고 Puppeteer가 인스타 규격 PNG(1080×1350)로 자동 추출하는 로컬 도구.

## 개요

- **무엇을**: 콘텐츠 URL → 슬라이드 HTML 생성 → PNG(1080×1350, 인스타 4:5) 자동 추출 → ZIP 다운로드
- **누구를 위해**: 고방 카드뉴스(시리즈픽) 제작 담당자
- **왜**: 디자인 규칙을 고정한 템플릿 + Claude 자동 기획으로 카드뉴스 제작을 반복·자동화

## 코어

### 핵심 동작 원리
1. **콘텐츠 읽기**: WebFetch로 URL 접속, 본문을 요약하지 않고 원문 그대로 추출
2. **슬라이드 기획·HTML 생성**: 타입별 `STYLE.md` 규칙을 따라 `core/output/{슬러그}/slides/slide-0N.html` 생성
3. **PNG 추출**: `node core/extract.js`(Puppeteer)가 HTML을 1080×1350 PNG로 렌더 → `core/output/{슬러그}/png/`
   - 콘솔에 `⚠️ OVERFLOW` 경고가 뜬 슬라이드만 HTML 수정 후 재추출

### 타입별 스타일
| 타입 | 템플릿 폴더 | ZIP prefix |
|---|---|---|
| A (기본) | `core/templates/gobang-시리즈픽/` | 없음 |
| B | `core/templates/gobang-B/` | `B-` |
| C | `core/templates/gobang-C/` | `C-` |

DRIVE_TASK에 `type` 필드가 있으면 해당 폴더 `STYLE.md`를 따르고, 없으면 A타입. 상세 작업 규칙은 [CLAUDE.md](CLAUDE.md) 및 각 템플릿의 `STYLE.md` 참고.

### 기술 스택
- Node.js (v18 이상)
- [Claude Code](https://claude.com/claude-code) — **Max 플랜 필요** (Pro 불가, 1인 1계정)
- `puppeteer` — HTML → PNG 렌더링
- `express` — 컨트롤 패널(runner) 서버
- `googleapis` / `multer` / `archiver` / `adm-zip` — 드라이브 연동·업로드·ZIP 처리

### 데이터 흐름 / 폴더 구조
```
insta-cardnews/
├── CLAUDE.md                  # Claude 작업 규칙 (수정 금지)
├── core/                      # 카드뉴스 생성 본체
│   ├── extract.js             # HTML → PNG (Puppeteer)
│   ├── drive.js / process.js  # 드라이브·로컬 일괄 처리 (DRIVE_TASK 파싱)
│   ├── auth.js                # 구글 인증
│   ├── templates/             # gobang-시리즈픽 / gobang-B / gobang-C (각 STYLE.md)
│   └── output/{슬러그}/        # slides/slide-0N.html, png/slide-0N.png
└── runner/                    # 컨트롤 패널 (웹 UI, 선택적)
    ├── server.js
    ├── public/index.html
    └── 시작 3017.bat
```

### 일괄 처리 모드
- **"드라이브 처리"** 입력 → `node core/drive.js`로 DRIVE_TASK 파싱 → 각 작업 처리 → 완료 폴더 업로드, 원본 ZIP 이동
- **"로컬 처리"** 입력 → `node core/process.js`로 파싱 → 처리 → `완료/`에 결과 ZIP, 원본은 `대기중/작업완료/` 이동

## 실행 / 배포 방법

로컬 전용(`for_Local`). 시크릿(구글 인증 토큰 등)은 `core/auth.js` 흐름으로 로컬에 발급·저장하며 **값은 저장소에 기재하지 않는다.**

```bash
# 최초 1회
git clone https://github.com/gobangMkt/cardnewsmaker
cd cardnewsmaker
npm install            # Puppeteer 포함
claude --version       # Claude Code 로그인 확인

# 카드뉴스 생성 — Claude Code 터미널에서
claude
# 채팅창에 URL 입력:  https://gobang.kr/contents/7824 카드뉴스 만들어.

# 컨트롤 패널 (웹 UI)
npm start              # = node runner/server.js (port 3017)

# 직접 PNG 추출
node core/extract.js core/output/{슬러그}
```

주요 스크립트: `npm start`(컨트롤 패널) · `npm run extract` · `npm run drive` · `npm run process` · `npm run auth`

- **포트**: 3017 (`runner/server.js`)
- **시크릿 위치**: 구글 인증 토큰 — `core/auth.js`로 발급, 로컬 파일 보관 (값 기재 금지)

### 컨트롤 패널 기능 (http://localhost:3017)
- **미리보기** — PNG 갤러리 확인
- **전체 ZIP** — 슬라이드 일괄 다운로드
- **다시 렌더** — HTML 수정 후 PNG만 재생성

## 디자인 규칙 요약 (A타입)

| 항목 | 값 |
|------|----|
| 캔버스 | 1080 × 1350 px (인스타 4:5) |
| 폰트 | Pretendard |
| 강조색 | `#009AB5` |
| 배경 | `#F8FAFD` (일반) / `#1E2124` (커버·마무리) |
| 푸터 | "시리즈픽" 고정 |
| 슬라이드 수 | 보통 7장 (커버 1 + 본문 5 + 마무리 1) |

## 배포링크 (로컬)

- 접속: http://localhost:3017
- 실행 배치: `프로젝트/for_Local/인스타자동화/runner/시작 3017.bat`
- Claude Code 실행 배치: `프로젝트/for_Local/인스타자동화/처리.bat`

## 문제 해결

- **`npm install` 중 Puppeteer 다운로드 실패**: `PUPPETEER_SKIP_DOWNLOAD=true npm install` 후 `core/extract.js` 상단 `executablePath`에 로컬 Chrome 경로 지정
- **포트 3017 사용 중**: `runner/server.js`의 `PORT` 변경 + `runner/시작 3017.bat` 동기 수정
- **PNG 미생성**: `node core/extract.js core/output/{슬러그}` 직접 실행해 오류 확인
