# 배당주 대시보드 — Next.js Frontend

미국 배당성장주 모니터링 대시보드. Streamlit(Python) 백엔드와 SQLite DB를 공유하며, 프론트는 Next.js 15로 운영.

---

## ⚠️ 페이지 점검 시 절대 규칙 (반드시 준수)

사용자가 "전체 페이지 점검", "오류 정리", "확인" 등을 요청할 때:

### 금지 행동 (실제 발생한 잘못)
- ❌ fetch 패턴만 grep으로 보고 "점검 완료"라고 답하기
- ❌ API 응답만 보고 화면이 정상이라 추정
- ❌ "이 정도면 됐다" 판단으로 일부 페이지 건너뛰기
- ❌ 점검 원칙을 답변에 쓰기만 하고 파일에 저장 안 하기

### 필수 절차 (모든 페이지에 빠짐없이 적용)
1. **각 페이지 page.tsx 전체를 Read** (offset/limit 없이 또는 끝까지 분할 읽기)
2. **렌더링되는 모든 요소를 식별** — 테이블 행/컬럼, 카드, 차트, 셀렉트, 배지
3. **각 요소가 의존하는 데이터 소스 추적** — WATCHLIST? customWatchlist? candidates? screening?
4. **현재 상태 기준 시뮬레이션** — WATCHLIST=[] 상태에서 각 요소가 어떻게 보이는지 머릿속으로 렌더
5. **발견된 모든 문제를 페이지별로 기록** — 추측 금지, "괜찮아 보임"이라고 결론 짓지 말 것

### 점검 대상 페이지 (반드시 모두)
- `/` 홈
- `/portfolio` 포트폴리오
- `/discover` 신규 발굴
- `/screener` 종목 스크리너
- `/candidates` 예비 후보함
- `/simulation` 배당 시뮬레이션
- `/signals` 매수 신호
- `/calendar` 배당 캘린더
- `/macro` 거시경제

### 자주 놓치는 의존성 (이번 세션에서 실제 발견된 버그 패턴)
- `WATCHLIST.map(...)` — WATCHLIST 비웠으므로 빈 배열 → 차트/그룹/셀렉트 빈 화면
- `WL_MAP[ticker]?.name` — 종목명 모두 "–"
- `staticTickers = new Set(WATCHLIST.map(...))` — 필터 로직 무력화
- `screening_results`만 보는 페이지 — universe_screening 폴백 누락 → BR 등 빈 행
- `candidates fetch` 누락한 페이지 — 후보함 종목 미반영

### 답변 원칙
- 점검 원칙·약속을 말로만 하지 말고 **즉시 이 파일에 저장**
- "다음 세션에서…" 같은 미래 약속은 무의미 — 다음 세션 Claude는 모름. 파일에 저장된 것만 효력 있음

---

---

## 인프라 / 배포

- **위치**: `/home/alan/dividend-dashboard-next` (이 디렉토리)
- **포트**: 3001 (production)
- **프로세스 관리**: PM2 (`dividend-dashboard-next`)
- **빌드 → 재시작**: `npm run build && pm2 restart dividend-dashboard-next` (반드시 빌드 후 재시작 — dev 모드 아님)
- **공유 DB**: `/home/alan/projects/dividend-dashboard/data/dashboard.db` (Python 백엔드와 공유)
- **Python 백엔드**: `/home/alan/projects/dividend-dashboard/` (데이터 수집 · 스크리닝)

---

## DB 구조 — 평가 테이블이 둘이라는 점이 가장 중요

| 테이블 | 평가 대상 | 갱신 주체 |
|---|---|---|
| `screening_results` | WATCHLIST + custom_watchlist (감시 종목만) | `run_screener()` Python |
| `universe_screening` | S&P 500 503종목 전체 | `fetch_universe.py` Python |

**중요**: 어떤 페이지가 종목 평가 결과(`overall_pass`, `buy_signal`)를 보여줄 때 **두 테이블 모두 폴백 조회**해야 함:

```sql
COALESCE(sc.buy_signal, us.buy_signal) AS buy_signal
```

`screening_results` 우선, 없으면 `universe_screening` 폴백. 후보함이나 미추적 종목이 누락되는 버그가 자주 여기서 발생.

기타 테이블: `stock_data`(주가·배당 raw), `candidates`(후보함), `custom_watchlist`(사용자 추가 감시), `criteria`(스크리닝 임계값)

---

## 종목 분류 체계 (3단계)

책 『배당주로 연봉벌기』 기준에 맞춰 다음 3단계로 분류:

| 분류 | 정의 | 책 근거 |
|---|---|---|
| ✅ **기준 통과** (`overall_pass=1`) | 배당성향·PEG·ROE 등 7개 기준 충족 — "좋은 회사인가?" | 3장 4기준 + 4장 7기준 |
| 📉 **가격 매력** (`buy_signal=1`) | 현재 배당률 ≥ 5년 평균 + 임계값 — "지금 살 만한가?" | 4장 매수 타이밍 |
| 🎯 **매수 후보** | ✅ AND 📉 둘 다 충족 — 실행 가능한 신호 | 책 종합 |

**임계값**: `yield_vs_avg_min = 1.0%p` (DB criteria 테이블에 저장). 0.0이면 노이즈가 너무 많음 (실측: 19→1건으로 줄어듦).

UI 컴포넌트: `app/components/VerdictBadge.tsx` — 4상태(🎯/✅/⚠️/–) 배지 재사용.

---

## 사용자 흐름 (메뉴 순서가 곧 흐름)

```
홈 → 포트폴리오
──── 투자 의사결정 흐름 ────
신규 발굴 (S&P 500)
  ↓ [+ 후보] (POST /api/candidates)
예비 후보함 (메모·주수·매수링크 관리)
  ↓ [시뮬레이션 실행] (?candidates=TICKER:shares URL 파라미터)
배당 시뮬레이션 (세후 배당 계산)
──── 모니터링 ────
매수 신호 / 배당 캘린더 / 거시경제
```

**핵심 원칙**: `[+ 후보]` 한 번 누르면 → candidates 테이블 INSERT → **홈/스크리너/후보함 3페이지에 동시 노출**. 별도로 옮기지 않음.

---

## 데이터 표시 4단계 (배당 관련)

`–`만 쓰면 사용자가 "데이터 누락"으로 오해. 다음 4단계로 명확히 구분:

| 표시 | 조건 | 의미 |
|---|---|---|
| **2.50%** (녹색) | `div_yield > 0` AND `> div_yield_5y` | 정상 + 가격 매력 |
| **2.50%** (검정) | `div_yield > 0` | 정상 배당 |
| **무배당** (회색 라벨) | `div_yield = 0` | Adobe·Autodesk 등 회사 정책 (정상) |
| **❓** (주황) | `div_yield = null` | API 미제공 |
| **–** | 무배당 종목의 5년평균/배당성향 | 의미 없는 필드 |

---

## 자주 밟는 트랩

### Next.js 15 Route Handler params
```ts
// ❌ 옛날 방식
export async function PATCH(req, { params }: { params: { id: string } })

// ✅ Next.js 15
export async function PATCH(req, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

### useSearchParams는 Suspense 필수
```tsx
// SimulationContent를 별도 함수로 분리하고 default export는 Suspense로 감싸기
export default function Page() {
  return <Suspense fallback={...}><Content /></Suspense>
}
```

### S&P 500 갱신 (Wikipedia 503 회피)
- `pandas.read_html()` 직접 호출 시 Wikipedia가 default urllib UA 차단(403)
- `requests.get()`으로 UA 헤더 붙여 fetch → `io.StringIO`로 pandas에 전달
- `lxml` 패키지 필요 (`pip install lxml`)

### 갱신 작업은 백그라운드 + 폴링
- `/api/refresh/universe` POST = `spawn detached + unref` → 즉시 반환
- GET으로 상태 폴링 (`/tmp/dividend-universe-fetch.status.json`)
- 503종목 × yfinance 호출 = 5~10분 → API 타임아웃 방지

### 엑셀 틀고정 (sticky header + sticky columns)
긴 테이블(스크리너·매수신호·시뮬레이션·발굴)에 적용:
```tsx
<div className="overflow-auto max-h-[600px]">
  <table className="border-collapse">
    <thead><tr className="sticky top-0 z-20 bg-slate-50">
      <th className="sticky left-0 z-30 bg-slate-50 border-r">티커</th>
```
행도 같은 위치에 `sticky left-0 z-10` + 행 배경색 변수 처리(`rowBg`).

---

## 저자 추천 종목

`lib/author-picks.ts` — 책 25.12.28 기준 저자 보유 11종목 + 3억 포트폴리오 템플릿 + 4대 가치투자 대가 공통보유 7종목.

5대 핵심(MSFT/MCO/AAPL/GOOGL/MA)은 **candidates 테이블에 자동 시드**되어 있음. 초기화 시 다시 INSERT 필요:

```sql
INSERT OR REPLACE INTO candidates (ticker, name, added_at, target_shares, memo, status) VALUES
  ('MSFT',  '마이크로소프트', datetime('now'), 10, '저자 5대 핵심', 'watching'),
  ('MCO',   '무디스',         datetime('now'), 10, '저자 5대 핵심', 'watching'),
  ('AAPL',  '애플',           datetime('now'), 10, '저자 5대 핵심', 'watching'),
  ('GOOGL', '알파벳',         datetime('now'), 10, '저자 5대 핵심', 'watching'),
  ('MA',    '마스터카드',     datetime('now'), 10, '저자 5대 핵심', 'watching');
```

---

## 책 정리본

`/home/alan/projects/referfiles/배당주로-연봉벌기-핵심정리.md` — 79페이지 전체 요약. 분류 기준이나 매수 시그널 로직 변경 시 항상 책 근거 확인.
