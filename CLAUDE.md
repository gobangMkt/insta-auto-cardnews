# 카드뉴스 생성 워크플로우

URL → 슬라이드 HTML → PNG 추출.

## 1. 콘텐츠 읽기
WebFetch로 URL 접속. 프롬프트: "제목, H2/H3 소제목, 본문 단락을 요약하지 말고 원문 문장 그대로 최대한 길게 추출해줘. 맥락·이유·배경·예시·수치·리스트 전부 포함."

## 2. 슬라이드 기획

- **장수**: cover 포함 최대 10장. closing 없음.
- **구조**: 1장 cover → 2장 `text-notitle` 인트로(본문 첫 단락 원문) → 3장~ H2 단락 기준 1~2장씩.
- **콘텐츠 원칙**: 수치 나열 금지. 독자가 "왜?", "그래서 나는 어떻게?"를 느낄 수 있게 맥락·의미·행동 유도까지 담는다. 슬라이드 한 장이 그 자체로 유익해야 한다.
- **이미지 사용 원칙**: 제공된 이미지는 **전부** 사용. 이미지 1개당 이미지 템플릿(`text-cell` 또는 `img-list`) 슬라이드 1장 이상 배정.
- **분량**: 텍스트가 슬라이드 영역(top 115px ~ bottom 128px)을 벗어나지 않을 만큼 최대한 풍부하게.
- **이모지**: `templates/gobang-시리즈픽/EMOJI-GUIDE.md` 참고.

**템플릿 선택:**
| 템플릿 | 용도 |
|---|---|
| `cover` | 1장 전용 |
| `text-notitle` | 2장 인트로 전용 |
| `text` | callout 포함 텍스트 |
| `text-normal` | 순수 텍스트 |
| `list` | 순위/목록 (rank-badge ± 불릿) |
| `text-cell` | 텍스트 + 이미지 |
| `img-list` | 이미지 + 순위 |
| `table` | 구분-내용 매핑 표 |

## 3. HTML 생성

`core/templates/gobang-시리즈픽/` CSS **그대로 복사** — 폰트 크기·여백·색상 변경 금지.
저장 위치: `core/output/{슬러그}/slides/slide-0N.html`

---

## 템플릿별 작성 규칙

### cover
- `BG_IMAGE_URL`: 사용자 제공 URL 또는 og:image만 (AI 생성 금지)
- 헤드라인 2줄 이내. 1줄=흰색, 2줄=`<span class="key">` (#00FFFF). 강한 후킹·어그로·밈.
- 다크 오버레이·카테고리 뱃지·부제목 라벨 금지. bubble은 선택.

### text-notitle (2장 인트로)
- `<p class="body-text">` 2~3개. 본문 첫 단락 원문. 마지막 단락은 전환문 필수.
- 타이틀·아이콘·구분선 없음.

### text (callout)
- 구성: 줄글(맥락) → callout(핵심) → 줄글(결론). callout 단독 금지.

### text-normal
- `body-text` 2~3개 단락 + bullets 혼합.

### text-cell
- 구성: 줄글(맥락 1~2문장) → 이미지 → bullets → 줄글(결론). 줄글·bullets 중 하나만 금지.
- 이미지 경로: `../img/{파일명}`

### list
- 각 항목: rank-badge + group-title + body(줄글) + bullets. body만 또는 bullets만 금지.
- 항목 수는 overflow 나지 않을 만큼만.

### img-list
- 구성: 헤드라인 → 이미지 → 항목(rank-badge + group-title + body). 항목 수 1~2개 권장.

### table
- TOP_BODY(선택) → 표(행 4개 이내) → BOTTOM_BODY(선택).
- 좌측 `<th>` 200px 굵게.

---

## 공통 규칙

- 캔버스 **1080×1350px** 고정. `overflow:hidden` + `word-break:keep-all`.
- 외부 CDN: Pretendard 1개만. footer 항상 "시리즈픽". 타이틀 항상 해요체.
- letter-spacing `-0.02em` (커버만 `-0.05em`).
- **highlight**: `color:#009AB5; font-weight:700`. 단어·수치 기본, 전환문 전체 허용.
- **badge 배경**: `rgba(0,154,181,0.2)`. red 금지.
- 수치·조건은 원문 그대로 (임의 생성 금지).

### 본문 가독성 (필수)
- **줄글 + 개괄식 혼합 필수** (cover·text-notitle 제외). 기본 순서: 줄글(맥락) → 개괄식(핵심) → 줄글(결론). 이미지 있으면 줄글 → 이미지 → 개괄식 → 줄글도 허용.
- 본문이 2~3줄 초과 시 반드시 단락 나눔.
- 개괄식 종류: 키-값 불릿 `div.bullets > div.bullet-item` / 체크리스트 `callout` / 순서 목록 `div.num-list > div.num-item`

## 4. PNG 추출 및 확인

```bash
node core/extract.js core/output/{슬러그}
```
**추출 후 반드시 PNG 전수 Read로 육안 확인. overflow·footer 겹침 있으면 HTML 수정 후 재추출.**

---

## 드라이브 처리

**"드라이브 처리"** 입력 시 즉시 실행. 설명·확인 없이 바로 시작.

1. `node core/drive.js` → DRIVE_TASK JSON 파싱 (`url`, `slug`, `outputDir`, `imgDir`, `images` 추출). ZIP 없으면 종료.
2. 각 DRIVE_TASK마다: WebFetch로 URL 읽기 → 이미지 Read → 슬라이드 HTML 생성 (위 규칙 동일) → `node core/extract.js core/output/{slug}` → **PNG 전수 육안 확인 → 문제 있으면 수정 후 재추출**
3. `node core/drive.js` 재실행 → 완료 폴더 업로드 → 원본 ZIP 이동.
- DRIVE_TASK 여러 개면 순서대로 전부 처리.
