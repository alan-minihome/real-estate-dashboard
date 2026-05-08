'use client'

import { useEffect, useState, useMemo } from 'react'
import VerdictBadge from '@/app/components/VerdictBadge'

interface UniverseItem {
  ticker: string; name: string
  tier: 'king' | 'aristocrat' | 'both' | null
  consecutive_years: number | null
  inWatchlist: boolean
  price: number | null; div_yield: number | null; div_yield_5y: number | null
  payout_ratio: number | null; div_growth_5y: number | null; peg: number | null
  sector: string | null; market_cap: number | null
  overall_pass: number | null; buy_signal: number | null; signal_reason: string | null
  screened_at: string | null
}

interface CustomItem { ticker: string; name: string; sector: string; tier: string; years: number }

type Tab = 'all' | 'dividend' | 'king' | 'aristocrat' | 'pass' | 'buy' | 'realbuy'

const TIER_LABEL: Record<string, string> = {
  king: '킹', aristocrat: '귀족', both: '킹+귀족',
}
const TIER_COLOR: Record<string, string> = {
  king:       'bg-amber-100 text-amber-800',
  aristocrat: 'bg-blue-100 text-blue-800',
  both:       'bg-purple-100 text-purple-700',
}

export default function DiscoverPage() {
  const [universe, setUniverse] = useState<UniverseItem[]>([])
  const [customList, setCustomList] = useState<CustomItem[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState<{ state: string; logTail?: string; message?: string } | null>(null)
  const [error, setError] = useState('')
  const [usdkrw, setUsdkrw] = useState<number | null>(null)

  const [tab, setTab] = useState<Tab>('realbuy')
  const [sectorFilter, setSectorFilter] = useState<string>('전체')
  const [minYield, setMinYield] = useState<number>(0)
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 일괄 선택
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState('')
  // 후보함 추가 상태
  const [candidateAdded, setCandidateAdded] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch('/api/universe').then(r => r.json()),
      fetch('/api/market').then(r => r.json()).catch(() => null),
      fetch('/api/watchlist/custom').then(r => r.json()).catch(() => []),
    ]).then(([d, market, custom]) => {
      if (d.error) { setError(d.error); return }
      const customTickers = new Set((custom as CustomItem[]).map(c => c.ticker))
      const uni = (d.universe || []).map((u: UniverseItem) => ({
        ...u,
        inWatchlist: u.inWatchlist || customTickers.has(u.ticker),
      }))
      setUniverse(uni)
      setCustomList(Array.isArray(custom) ? custom : [])
      setLastUpdated(d.last_updated || null)
      if (market?.USDKRW?.price) setUsdkrw(market.USDKRW.price)
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])

  async function reloadUniverse() {
    const r2 = await fetch('/api/universe')
    const d2 = await r2.json()
    const customTickers = new Set(customList.map(c => c.ticker))
    setUniverse((d2.universe || []).map((u: UniverseItem) => ({
      ...u, inWatchlist: u.inWatchlist || customTickers.has(u.ticker),
    })))
    setLastUpdated(d2.last_updated || null)
  }

  async function pollStatus() {
    try {
      const r = await fetch('/api/refresh/universe')
      const s = await r.json()
      setRefreshStatus(s)
      if (s.state === 'done' || s.state === 'idle' || s.state === 'error') {
        setRefreshing(false)
        await reloadUniverse()
        return true
      }
      // 진행 중에도 부분 데이터 반영 (옵션)
      await reloadUniverse()
      return false
    } catch (e) {
      console.error(e)
      return false
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setError('')
    try {
      const r = await fetch('/api/refresh/universe', { method: 'POST' })
      const d = await r.json()
      if (!d.ok && d.status?.state !== 'running') {
        setError(d.error || '갱신 시작 실패')
        setRefreshing(false)
        return
      }
      // 폴링 시작 (15초 간격)
      const interval = setInterval(async () => {
        const done = await pollStatus()
        if (done) clearInterval(interval)
      }, 15_000)
    } catch (e) {
      setError(String(e))
      setRefreshing(false)
    }
  }

  // 페이지 진입 시 진행 중인 작업이 있으면 폴링 재개
  useEffect(() => {
    fetch('/api/refresh/universe').then(r => r.json()).then(s => {
      if (s.state === 'running') {
        setRefreshing(true)
        setRefreshStatus(s)
        const interval = setInterval(async () => {
          const done = await pollStatus()
          if (done) clearInterval(interval)
        }, 15_000)
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addToWatchlist() {
    if (selected.size === 0) return
    setAdding(true)
    setAddMsg('')
    const items = [...selected].map(ticker => {
      const u = universe.find(u => u.ticker === ticker)!
      return { ticker: u.ticker, name: u.name, sector: u.sector, tier: u.tier, years: u.consecutive_years }
    })
    const r = await fetch('/api/watchlist/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    const d = await r.json()
    if (d.ok) {
      setUniverse(prev => prev.map(u => selected.has(u.ticker) ? { ...u, inWatchlist: true } : u))
      setAddMsg(`${d.added}종목 추가 완료`)
      setSelected(new Set())
    } else {
      setAddMsg(`실패: ${d.error}`)
    }
    setAdding(false)
  }

  async function addToCandidate(ticker: string, name: string) {
    await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, name }),
    })
    setCandidateAdded(prev => new Set(prev).add(ticker))
  }

  function toggleSelect(ticker: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  // 섹터 목록 (중복 제거)
  const sectors = useMemo(() => {
    const s = new Set(universe.map(u => u.sector).filter(Boolean) as string[])
    return ['전체', ...Array.from(s).sort()]
  }, [universe])

  // 탭·섹터·배당률·검색 필터 적용
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toUpperCase()
    return universe.filter(u => {
      // 검색어 있으면 탭·섹터·배당률 무시, 티커/종목명 매칭만 적용
      if (q) {
        if (!u.ticker.includes(q) && !(u.name || '').toUpperCase().includes(q)) return false
        if (!showWatchlist && u.inWatchlist) return false
        return true
      }
      if (!showWatchlist && u.inWatchlist) return false
      if (sectorFilter !== '전체' && u.sector !== sectorFilter) return false
      if (minYield > 0 && (!u.div_yield || u.div_yield < minYield)) return false
      if (tab === 'dividend')    return (u.div_yield ?? 0) > 0
      if (tab === 'king')        return u.tier === 'king' || u.tier === 'both'
      if (tab === 'aristocrat')  return u.tier === 'aristocrat' || u.tier === 'both'
      if (tab === 'pass')        return u.overall_pass === 1
      if (tab === 'buy')         return u.buy_signal === 1
      if (tab === 'realbuy')     return u.overall_pass === 1 && u.buy_signal === 1
      return true
    })
  }, [universe, tab, sectorFilter, minYield, showWatchlist, searchQuery])

  // 정렬: 둘 다 통과(진짜 매수후보) → 기준통과 → 매수신호 → 배당률
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const realA = (a.overall_pass === 1 && a.buy_signal === 1) ? 1 : 0
    const realB = (b.overall_pass === 1 && b.buy_signal === 1) ? 1 : 0
    if (realB !== realA) return realB - realA
    if ((b.overall_pass ?? 0) !== (a.overall_pass ?? 0)) return (b.overall_pass ?? 0) - (a.overall_pass ?? 0)
    if ((b.buy_signal ?? 0) !== (a.buy_signal ?? 0)) return (b.buy_signal ?? 0) - (a.buy_signal ?? 0)
    return (b.div_yield ?? 0) - (a.div_yield ?? 0)
  }), [filtered])

  const hasData = universe.some(u => u.screened_at !== null)
  const totalCount     = universe.length
  const dividendCount  = universe.filter(u => (u.div_yield ?? 0) > 0).length
  const passCount      = universe.filter(u => !u.inWatchlist && u.overall_pass === 1).length
  const buyCount       = universe.filter(u => !u.inWatchlist && u.buy_signal === 1).length
  const kingCount      = universe.filter(u => u.tier === 'king' || u.tier === 'both').length
  const aristocratCount = universe.filter(u => u.tier === 'aristocrat' || u.tier === 'both').length
  const realBuyCount   = universe.filter(u => !u.inWatchlist && u.overall_pass === 1 && u.buy_signal === 1).length
  const trapCount      = universe.filter(u => !u.inWatchlist && u.overall_pass === 0 && u.buy_signal === 1).length

  const selectableInView = filtered.filter(u => !u.inWatchlist)
  const allSelected = selectableInView.length > 0 && selectableInView.every(u => selected.has(u.ticker))

  const formatDate = (iso: string | null) => iso ? iso.slice(0, 10) : '–'

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>

  return (
    <div className="max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">신규 종목 발굴</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            S&P 500 {totalCount}종목 탐색 — 마음에 들면 [+ 후보]로 담고, 임계값 조정은 <a href="/screener" className="text-[#1A56DB] hover:underline">🔍 스크리너</a>에서
            {lastUpdated && <span className="ml-2 text-xs text-slate-400">· 최근 갱신 {formatDate(lastUpdated)}</span>}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {refreshing ? '수집 중… (5~10분 소요)' : '🔄 S&P 500 갱신'}
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">⚠️ {error}</div>}

      {refreshing && refreshStatus?.state === 'running' && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-[#1A56DB]">S&P 500 수집 중... (백그라운드 진행, 5~10분 소요)</span>
          </div>
          {refreshStatus.logTail && (
            <details className="mt-2">
              <summary className="text-xs text-[#64748B] cursor-pointer">진행 로그 보기</summary>
              <pre className="mt-2 text-[10px] text-[#64748B] bg-white p-2 rounded max-h-40 overflow-auto">{refreshStatus.logTail}</pre>
            </details>
          )}
        </div>
      )}

      {!hasData && (
        <div className="mb-6 p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <p className="font-semibold mb-1">📋 아직 유니버스 데이터가 없습니다</p>
          <p>상단 [S&P 500 갱신] 버튼을 눌러 데이터를 수집해 주세요. S&P 500 전체 약 500개 종목 수집에 5~10분 소요됩니다.</p>
        </div>
      )}

      {/* 종목 분류 기준 안내 (접이식) */}
      <div className="mb-4 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <button
          onClick={() => setShowGuide(v => !v)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📖</span>
            <span className="font-medium text-[#0F172A]">종목 분류 기준 — 매수 후보 / 기준 통과 / 가격 매력의 차이</span>
          </div>
          <span className="text-[#64748B] text-xs">{showGuide ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        {showGuide && (
          <div className="px-5 py-4 border-t border-[#E2E8F0] bg-slate-50/40 space-y-4">
            {/* 깔때기 시각화 */}
            <div>
              <p className="text-xs font-semibold text-[#64748B] mb-2">의사결정 깔때기</p>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[#64748B]">
                  S&P 500 전체 <span className="font-bold text-[#0F172A]">{totalCount}</span>
                </span>
                <span className="text-[#94A3B8]">→</span>
                <span className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[#1A56DB]">
                  ✅ 기준 통과 <span className="font-bold">{passCount}</span>
                </span>
                <span className="text-[#94A3B8]">+</span>
                <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                  📉 가격 매력 <span className="font-bold">{buyCount}</span>
                </span>
                <span className="text-[#94A3B8]">=</span>
                <span className="px-3 py-1.5 bg-emerald-100 border-2 border-emerald-400 rounded-lg text-emerald-800 font-medium">
                  🎯 매수 후보 <span className="font-bold">{realBuyCount}</span>
                </span>
                {trapCount > 0 && (
                  <>
                    <span className="text-[#94A3B8]">·</span>
                    <span className="px-3 py-1.5 bg-orange-50 border border-orange-300 rounded-lg text-orange-700">
                      ⚠️ 함정 주의 <span className="font-bold">{trapCount}</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* 4개 지표 상세 설명 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-white border border-blue-200 rounded-lg p-3">
                <p className="font-semibold text-[#1A56DB] mb-1.5">✅ 기준 통과</p>
                <p className="text-[#64748B] mb-2 leading-relaxed">
                  &quot;<b>좋은 회사인가?</b>&quot;
                </p>
                <p className="text-[10px] text-[#94A3B8] mb-1">평가 항목 (7개)</p>
                <ul className="text-[11px] text-[#475569] space-y-0.5 list-disc list-inside leading-relaxed">
                  <li>배당성향 ≤ 70%</li>
                  <li>5년 배당성장률 ≥ 5%</li>
                  <li>PEG ≤ 1.5</li>
                  <li>D/E ≤ 2</li>
                  <li>ROE ≥ 15%</li>
                  <li>EPS 성장 ≥ 5%</li>
                  <li>FCF 배당성향 ≤ 80%</li>
                </ul>
                <p className="text-[10px] text-[#94A3B8] mt-2">가격 무관 · 종목 품질만 본다</p>
              </div>

              <div className="bg-white border border-amber-200 rounded-lg p-3">
                <p className="font-semibold text-amber-700 mb-1.5">📉 가격 매력</p>
                <p className="text-[#64748B] mb-2 leading-relaxed">
                  &quot;<b>지금 살 만한 가격인가?</b>&quot;
                </p>
                <p className="text-[10px] text-[#94A3B8] mb-1">평가 공식</p>
                <div className="text-[11px] text-[#475569] bg-slate-50 rounded p-2 font-mono leading-relaxed">
                  현재 배당률<br/>
                  ≥ 5년 평균 + <b>1.0%p</b>
                </div>
                <p className="text-[10px] text-[#94A3B8] mt-2">
                  종목 품질 무관 · 책 4장 &quot;5년 평균보다 높을 때만 매수&quot; 원칙
                </p>
              </div>

              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-3">
                <p className="font-semibold text-emerald-700 mb-1.5">🎯 매수 후보</p>
                <p className="text-[#64748B] mb-2 leading-relaxed">
                  &quot;<b>좋은 회사 + 좋은 가격</b>&quot;
                </p>
                <p className="text-[10px] text-[#94A3B8] mb-1">조건</p>
                <div className="text-[11px] text-[#475569] bg-white rounded p-2 leading-relaxed">
                  ✅ 기준 통과<br/>
                  <span className="text-amber-700">AND</span><br/>
                  📉 가격 매력
                </div>
                <p className="text-[10px] text-emerald-700 mt-2 font-medium">
                  실행 가능한 진짜 매수 신호
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
                <p className="font-semibold text-orange-700 mb-1.5">⚠️ 함정 주의</p>
                <p className="text-[#64748B] mb-2 leading-relaxed">
                  &quot;<b>싸 보이지만 품질 미달</b>&quot;
                </p>
                <p className="text-[10px] text-[#94A3B8] mb-1">조건</p>
                <div className="text-[11px] text-[#475569] bg-white rounded p-2 leading-relaxed">
                  ❌ 기준 미통과<br/>
                  <span className="text-orange-600">AND</span><br/>
                  📉 가격 매력
                </div>
                <p className="text-[10px] text-orange-700 mt-2 leading-relaxed">
                  배당률이 역사 평균보다 높다 = 주가가 눌려 있다는 뜻.
                  이유가 실적 악화·배당 삭감 위험일 수 있으니 매수 전 반드시 원인 확인 필요.
                </p>
              </div>
            </div>

            {/* 예시 */}
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 text-xs">
              <p className="font-semibold text-[#0F172A] mb-2">💡 같은 좋은 회사도 시점에 따라 다릅니다</p>
              <div className="space-y-1.5 text-[#64748B] leading-relaxed">
                <p>
                  <span className="font-bold text-[#0F172A]">BLK (BlackRock)</span> — 7기준 통과 ✅ 이지만 현재 배당률 2.15% ≈ 5년 평균 2.13% →
                  <span className="text-amber-700"> 좋은 회사지만 지금은 비쌈</span>
                </p>
                <p>
                  <span className="font-bold text-[#0F172A]">BR (Broadridge)</span> — 7기준 통과 ✅ + 현재 배당률 2.53% &gt; 5년 평균 1.47% (+1.06%p) →
                  <span className="text-emerald-700 font-medium"> 🎯 좋은 회사를 싸게 살 기회</span>
                </p>
              </div>
              <p className="mt-2 text-[10px] text-[#94A3B8]">
                BLK가 6개월 뒤 주가 하락으로 배당률이 오르면 → 자동으로 🎯 매수 후보로 승격
              </p>
            </div>

            {/* 배당 등급 (King / Aristocrat) 설명 */}
            <div>
              <p className="text-xs font-semibold text-[#64748B] mb-2">📊 배당 등급 — 킹 vs 귀족</p>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-white border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">킹</span>
                    <span className="font-semibold text-[#0F172A]">배당 King ({kingCount}종목)</span>
                  </div>
                  <p className="text-[#64748B] mb-2 leading-relaxed">
                    <b>50년 이상</b> 연속 배당 증가
                  </p>
                  <ul className="text-[11px] text-[#475569] space-y-0.5 list-disc list-inside leading-relaxed">
                    <li>S&P 500 멤버십 무관</li>
                    <li>중소형주도 포함 가능</li>
                    <li>안전성 ★★★★★</li>
                  </ul>
                  <p className="text-[10px] text-[#94A3B8] mt-2">
                    예: ABM(57년), CWT(55년), AWR(69년)
                  </p>
                </div>

                <div className="bg-white border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">귀족</span>
                    <span className="font-semibold text-[#0F172A]">배당 Aristocrat ({aristocratCount}종목)</span>
                  </div>
                  <p className="text-[#64748B] mb-2 leading-relaxed">
                    <b>25년 이상</b> 연속 배당 증가
                  </p>
                  <ul className="text-[11px] text-[#475569] space-y-0.5 list-disc list-inside leading-relaxed">
                    <li>S&P 500 구성원 <b>필수</b></li>
                    <li>시가총액 30억 달러+</li>
                    <li>일평균 거래액 500만 달러+</li>
                  </ul>
                  <p className="text-[10px] text-[#94A3B8] mt-2">
                    예: AAPL는 13년차라 아직 미달, MSFT도 아님
                  </p>
                </div>

                <div className="bg-white border-2 border-purple-300 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">킹+귀족</span>
                    <span className="font-semibold text-[#0F172A]">둘 다 충족</span>
                  </div>
                  <p className="text-[#64748B] mb-2 leading-relaxed">
                    <b>50년+</b> 배당 증가 <b>AND</b> S&P 500 대형주
                  </p>
                  <ul className="text-[11px] text-[#475569] space-y-0.5 list-disc list-inside leading-relaxed">
                    <li>안전성 + 유동성 + 시간 검증</li>
                    <li>가장 보수적 선택</li>
                  </ul>
                  <p className="text-[10px] text-purple-700 mt-2 font-medium">
                    예: KO(62년), JNJ(62년), PG(68년), MMM(64년)
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-[#94A3B8] leading-relaxed">
                ⚠️ 킹·귀족이라고 무조건 매수가 아닙니다. <b>7기준 통과 + 5년 평균 배당률 비교(🎯 매수 후보)</b>까지 봐야 진짜 매수 시점.
                책 4장 &quot;5년 평균보다 높을 때만 매수&quot; 원칙.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* KPI 카드 — 진짜 매수 후보를 가장 강조 */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <button
          onClick={() => setTab('realbuy')}
          className={`text-left bg-emerald-50 rounded-xl border-2 p-4 transition-all hover:shadow-md ${
            tab === 'realbuy' ? 'border-emerald-500' : 'border-emerald-300'
          }`}
        >
          <p className="text-xs text-emerald-700 mb-1 font-medium">🎯 매수 후보 (둘 다 통과)</p>
          <p className="text-2xl font-bold text-emerald-700">{realBuyCount}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">기준 ✅ + 신호 ⚡</p>
        </button>

        <button
          onClick={() => setTab('pass')}
          className={`text-left bg-white rounded-xl border p-4 transition-all hover:shadow-sm ${
            tab === 'pass' ? 'border-[#1A56DB]' : 'border-[#E2E8F0]'
          }`}
        >
          <p className="text-xs text-[#64748B] mb-1">✅ 기준 통과</p>
          <p className="text-2xl font-bold text-[#1A56DB]">{passCount}</p>
          <p className="text-[10px] text-[#64748B] mt-0.5">좋은 종목 (가격 무관)</p>
        </button>

        <button
          onClick={() => setTab('buy')}
          className={`text-left bg-white rounded-xl border p-4 transition-all hover:shadow-sm ${
            tab === 'buy' ? 'border-amber-500' : 'border-[#E2E8F0]'
          }`}
        >
          <p className="text-xs text-[#64748B] mb-1">📉 가격 매력</p>
          <p className="text-2xl font-bold text-amber-600">{buyCount}</p>
          <p className="text-[10px] text-[#64748B] mt-0.5">5년 평균 +1%p 이상</p>
        </button>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#64748B] mb-1">배당 지급</p>
          <p className="text-2xl font-bold text-[#0F172A]">{dividendCount}</p>
          <p className="text-[10px] text-[#64748B] mt-0.5">전체의 {totalCount ? Math.round(dividendCount/totalCount*100) : 0}%</p>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#64748B] mb-1">S&P 500 전체</p>
          <p className="text-2xl font-bold text-[#0F172A]">{totalCount}</p>
          <p className="text-[10px] text-[#64748B] mt-0.5">유니버스</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="mb-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="티커 또는 종목명 검색 (예: AAPL, Microsoft)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-1.5 text-xs text-[#64748B]">
            검색 결과: <span className="font-medium text-[#0F172A]">{filtered.length}</span>종목
            <span className="ml-2 text-slate-400">— 탭·섹터·배당률 필터는 검색 중 비활성화됩니다</span>
          </p>
        )}
      </div>

      {/* 탭 */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className={`flex gap-1 bg-slate-100 rounded-lg p-1 ${searchQuery ? 'opacity-40 pointer-events-none' : ''}`}>
          {([
            { key: 'realbuy',    label: `🎯 매수 후보 (${realBuyCount})` },
            { key: 'pass',       label: `✅ 기준통과 (${passCount})` },
            { key: 'buy',        label: `📉 가격 매력 (${buyCount})` },
            { key: 'dividend',   label: `배당주 (${dividendCount})` },
            { key: 'king',       label: `킹 (${kingCount})` },
            { key: 'aristocrat', label: `귀족 (${aristocratCount})` },
            { key: 'all',        label: '전체' },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                tab === t.key ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 섹터·배당률 필터 */}
        <div className={`flex items-center gap-3 ${searchQuery ? 'opacity-40 pointer-events-none' : ''}`}>
          <select
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value)}
            className="text-xs border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-[#64748B] bg-white"
          >
            {sectors.map(s => <option key={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-[#64748B]">
            배당률 ≥
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={minYield}
              onChange={e => setMinYield(Number(e.target.value))}
              className="w-12 border border-[#E2E8F0] rounded px-1.5 py-1 text-center text-xs"
            />
            %
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
            <input type="checkbox" checked={showWatchlist} onChange={e => setShowWatchlist(e.target.checked)} className="rounded" />
            감시 목록 포함
          </label>
        </div>
      </div>

      {/* 일괄 추가 툴바 */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 px-4 py-3 bg-[#1A56DB] text-white rounded-xl">
          <span className="text-sm font-medium">{selected.size}종목 선택됨</span>
          <button
            onClick={addToWatchlist}
            disabled={adding}
            className="px-4 py-1.5 bg-white text-[#1A56DB] text-sm font-bold rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
          >
            {adding ? '추가 중...' : '★ 감시 목록 추가'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-blue-200 hover:text-white ml-auto">선택 해제</button>
          {addMsg && <span className="text-sm">{addMsg}</span>}
        </div>
      )}

      {/* 데이터 표시 범례 */}
      <div className="mb-2 flex items-center gap-4 text-[11px] text-[#64748B] flex-wrap px-1">
        <span className="font-medium text-[#475569]">표시 범례:</span>
        <span className="flex items-center gap-1">
          <span className="text-emerald-600 font-medium">2.50%</span>
          <span>현재 배당률 ≥ 5년 평균 (가격 매력)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-slate-400 text-[10px] font-medium">무배당</span>
          <span>배당 미지급 종목 (정상)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-amber-400">❓</span>
          <span>API 미제공 또는 이력 부족</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-slate-300">–</span>
          <span>해당없음 (무배당이라 평균/배당성향 의미 없음)</span>
        </span>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-auto max-h-[640px]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E2E8F0] sticky top-0 z-20">
              <th className="px-3 py-3 w-8 sticky left-0 bg-slate-50 z-30">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    const tickers = selectableInView.map(u => u.ticker)
                    if (allSelected) setSelected(prev => { const n = new Set(prev); tickers.forEach(t => n.delete(t)); return n })
                    else setSelected(prev => { const n = new Set(prev); tickers.forEach(t => n.add(t)); return n })
                  }}
                  className="rounded accent-[#1A56DB]"
                />
              </th>
              <th className="text-left px-3 py-3 font-medium text-[#64748B] sticky left-8 bg-slate-50 z-30 border-r border-[#E2E8F0]">티커</th>
              <th className="text-left px-4 py-3 font-medium text-[#64748B] min-w-[140px]">종목명</th>
              <th className="text-center px-2 py-3 font-medium text-[#64748B]">등급</th>
              <th className="text-left px-3 py-3 font-medium text-[#64748B] text-xs min-w-[120px]">섹터</th>
              <th className="text-right px-3 py-3 font-medium text-[#64748B]">주가</th>
              <th className="text-right px-3 py-3 font-medium text-[#64748B]">배당률</th>
              <th className="text-right px-3 py-3 font-medium text-[#64748B]">5년평균</th>
              <th className="text-right px-3 py-3 font-medium text-[#64748B]">배당성향</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B]">통과</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B]">신호</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B] min-w-[100px]">🎯 결과</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B]">후보 추가</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-12 text-[#64748B]">
                  {hasData ? '해당 조건의 종목이 없습니다' : '유니버스 갱신 후 확인하세요'}
                </td>
              </tr>
            ) : sorted.map((u, i) => {
              const isSelected = selected.has(u.ticker)
              const isRealBuy = u.overall_pass === 1 && u.buy_signal === 1
              const rowBg = isSelected
                ? 'bg-blue-50'
                : isRealBuy
                  ? 'bg-emerald-100'
                  : u.buy_signal ? 'bg-emerald-50/50' : i % 2 ? 'bg-slate-50/30' : 'bg-white'
              return (
                <tr key={u.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${rowBg}`}>
                  <td className={`px-3 py-2.5 text-center sticky left-0 z-10 ${rowBg}`}>
                    {u.inWatchlist ? (
                      <span className="text-[10px] text-[#1A56DB]">★</span>
                    ) : (
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(u.ticker)} className="rounded accent-[#1A56DB]" />
                    )}
                  </td>
                  <td className={`px-3 py-2.5 sticky left-8 z-10 border-r border-[#E2E8F0] ${rowBg}`}>
                    <span className="font-bold text-[#1A56DB]">{u.ticker}</span>
                    {u.inWatchlist && <span className="ml-1 text-[9px] text-slate-400">★</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[#0F172A] text-xs">{u.name}</td>
                  <td className="px-2 py-2.5 text-center">
                    {u.tier ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TIER_COLOR[u.tier]}`}>
                        {TIER_LABEL[u.tier]}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[#64748B] text-xs">{u.sector || '–'}</td>
                  <td className="px-3 py-2.5 text-right tabular">
                    {u.price ? (
                      <div>
                        <p className="text-[#0F172A] font-medium text-xs">${u.price.toFixed(2)}</p>
                        {usdkrw && <p className="text-[10px] text-[#94A3B8]">₩{Math.round(u.price * usdkrw).toLocaleString()}</p>}
                      </div>
                    ) : <span className="text-slate-300">–</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">
                    {u.div_yield && u.div_yield > 0 ? (
                      <span className={u.div_yield_5y && u.div_yield > u.div_yield_5y ? 'text-emerald-600 font-medium' : ''}>
                        {u.div_yield.toFixed(2)}%
                      </span>
                    ) : u.div_yield === 0 ? (
                      <span className="text-slate-400 text-[10px] font-medium" title="배당을 지급하지 않는 종목">무배당</span>
                    ) : (
                      <span className="text-amber-400" title="API에서 데이터를 제공하지 않음">❓</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular text-[#64748B] text-xs">
                    {u.div_yield_5y && u.div_yield_5y > 0 ? (
                      `${u.div_yield_5y.toFixed(2)}%`
                    ) : u.div_yield === 0 ? (
                      <span className="text-slate-300">–</span>
                    ) : (
                      <span className="text-amber-400" title="배당 이력 5년 미만 또는 API 미제공">❓</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular text-[#64748B] text-xs">
                    {u.payout_ratio && u.payout_ratio > 0 ? (
                      `${u.payout_ratio.toFixed(0)}%`
                    ) : u.div_yield === 0 ? (
                      <span className="text-slate-300">–</span>
                    ) : (
                      <span className="text-amber-400" title="순이익 적자 또는 API 미제공">❓</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {u.overall_pass === null ? <span className="text-slate-300">–</span> : u.overall_pass ? '✅' : '❌'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {u.buy_signal ? <span title={u.signal_reason || ''}>⚡</span> : ''}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <VerdictBadge overallPass={u.overall_pass} buySignal={u.buy_signal} signalReason={u.signal_reason} size="sm" />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {candidateAdded.has(u.ticker) ? (
                      <span className="text-emerald-600 text-xs font-medium">✓ 추가됨</span>
                    ) : (
                      <button
                        onClick={() => addToCandidate(u.ticker, u.name)}
                        className="text-xs px-2 py-0.5 border border-[#1A56DB] text-[#1A56DB] rounded hover:bg-blue-50 whitespace-nowrap"
                      >+ 후보</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-[#94A3B8]">
        {sorted.length}종목 표시 · ★ 이미 감시 중 · 체크박스 선택 후 감시 목록 일괄 추가 가능 · [+ 후보]로 예비 후보함에 추가
      </p>
    </div>
  )
}
