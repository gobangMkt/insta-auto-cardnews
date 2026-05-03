# 시리즈픽 카드뉴스 자동화

gobang.kr 콘텐츠 URL → Claude가 슬라이드 HTML 생성 → PNG 자동 추출 → 인스타 업로드

---

## 사전 요구사항

| 항목 | 버전/조건 |
|------|-----------|
| [Node.js](https://nodejs.org/) | v18 이상 |
| [Claude Code](https://claude.com/claude-code) | 설치 + 로그인 |
| Claude 플랜 | **Max 플랜** 필요 (Pro 불가) |
| Git | 최신 버전 |

> Claude Max 플랜은 1인 1계정. 여러 명이 동시에 사용하려면 각자 구독이 필요합니다.

---

## 초기 설정 (최초 1회)

```bash
# 1. 저장소 클론
git clone https://github.com/gobangMkt/cardnewsmaker
cd cardnewsmaker

# 2. 의존성 설치 (Puppeteer 포함)
npm install

# 3. Claude Code 로그인 확인
claude --version
```

---

## 카드뉴스 만드는 법

### Claude Code 터미널에서 직접 실행

```bash
# cardnewsmaker 폴더에서 claude 실행
cd cardnewsmaker
claude
```

채팅창에 URL만 입력하면 끝:

```
https://gobang.kr/contents/7824 카드뉴스 만들어.
```

Claude가 자동으로:
1. URL 크롤링 → 콘텐츠 파악
2. `core/output/{slug}/slides/` 에 HTML 슬라이드 생성
3. `node core/extract.js` 실행 → `core/output/{slug}/png/` 에 PNG 저장

---

## 결과물 확인 및 다운로드

### 방법 A — 파일 탐색기로 직접 접근

```
core/output/{slug}/png/
  slide-01.png
  slide-02.png
  ...
```

### 방법 B — 컨트롤 패널 (웹 UI)

```bash
# Windows
runner\시작 3017.bat   # 더블클릭

# 또는 터미널에서
npm start
```

브라우저에서 [http://localhost:3017](http://localhost:3017) 접속:
- **미리보기** — PNG 갤러리 확인
- **전체 ZIP** — 슬라이드 한 번에 다운로드
- **다시 렌더** — HTML 수정 후 PNG만 재생성

---

## 폴더 구조

```
cardnewsmaker/
├── CLAUDE.md                          # Claude 작업 규칙 (수정 금지)
├── package.json
│
├── core/                              # 카드뉴스 생성 본체
│   ├── extract.js                     # HTML → PNG 변환 (Puppeteer)
│   ├── templates/gobang-시리즈픽/      # 슬라이드 템플릿
│   │   ├── cover.html
│   │   ├── text-normal.html
│   │   ├── list.html
│   │   ├── table.html
│   │   └── closing.html  (+ 기타)
│   └── output/                        # 생성 결과물
│       └── {slug}/
│           ├── slides/slide-0N.html
│           └── png/slide-0N.png
│
└── runner/                            # 컨트롤 패널 (선택적)
    ├── server.js
    ├── public/index.html
    └── 시작 3017.bat
```

---

## 최신 내용 받기 (매번 작업 전)

```bash
cd cardnewsmaker
git pull
```

---

## 디자인 규칙 요약

| 항목 | 값 |
|------|----|
| 캔버스 | 1080 × 1350 px (인스타 4:5) |
| 폰트 | Pretendard |
| 강조색 | `#009AB5` |
| 배경 | `#F8FAFD` (일반) / `#1E2124` (커버·마무리) |
| 푸터 | "시리즈픽" 고정 |
| 슬라이드 수 | 보통 7장 (커버 1 + 본문 5 + 마무리 1) |

상세 작업 규칙은 [CLAUDE.md](CLAUDE.md) 참고.

---

## 문제 해결

**`npm install` 중 Puppeteer 다운로드 실패**
```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install
```
이후 `core/extract.js` 상단 `executablePath`에 로컬 Chrome 경로 지정 필요.

**포트 3017 이미 사용 중**
`runner/server.js` 상단 `PORT` 값 변경 후 `runner/시작 3017.bat`도 같이 수정.

**PNG가 생성되지 않을 때**
```bash
node core/extract.js core/output/{slug}
```
직접 실행해서 오류 메시지 확인.
