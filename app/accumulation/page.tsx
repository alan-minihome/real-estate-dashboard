'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { WATCHLIST } from '@/lib/watchlist'

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface StockData { ticker: string; price: number | null; div_yield: number | null }
interface EtfItem {
  ticker: string; name: string; div_yield: number | null; last_price: number | null
  category?: string; issuer?: string; us_equiv?: string
}
interface CandidateItem { ticker: string; name: string; status: string; price?: number | null; div_yield?: number | null }
interface CustomItem { ticker: string; name: string }
interface AccumItem {
  ticker: string; name: string; price: number; div_yield: number; currency: 'USD' | 'KRW'
  meta?: string  // category / issuer / us_equiv
}

// ─── 계좌 유형 ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  {
    id: 'general', label: '일반계좌', rate: 15.4,
    note: '배당소득세 14% + 지방소득세 1.4%. 금융소득 2,000만원 초과 시 종합과세.',
    tag: null,
  },
  {
    id: 'isa', label: 'ISA 중개형', rate: 9.9,
    note: '의무 가입 3년. 비과세 한도: 일반형 200만원/년, 서민·농어민 400만원/년. 초과분 9.9% 분리과세로 종합과세 배제.',
    tag: '절세',
  },
  {
    id: 'pension_a', label: '연금 (55~69세)', rate: 5.5,
    note: '연금소득세 5.5%. 납입 시 세액공제: 연금저축 600만원, IRP 합산 900만원까지 13.2~16.5%. 중도해지 16.5% 기타소득세.',
    tag: '절세',
  },
  {
    id: 'pension_b', label: '연금 (70~79세)', rate: 4.4,
    note: '연금소득세 4.4%. 연금 수령 개시 후 세율. 세액공제 혜택은 납입 기간에 별도 적용.',
    tag: '절세',
  },
  {
    id: 'pension_c', label: '연금 (80세+)', rate: 3.3,
    note: '연금소득세 3.3%. 고령자 우대 세율.',
    tag: '절세',
  },
] as const

type AccountId = typeof ACCOUNT_TYPES[number]['id']

// ─── KR ETF 수동 수익률 (yfinance KRX 한계 보완) ────────────────────────────

const KR_MANUAL: Record<string, number> = {
  '458730': 3.2,  '458760': 3.1,  '429000': 2.0,  '429050': 2.1,
  '469100': 8.5,  '476550': 7.2,  '437080': 11.8,
  '133690': 0.5,  '379800': 0.3,  '360750': 1.2,  '379810': 1.1,
  '251340': 1.0,  '352560': 3.5,  '492580': 3.8,
  '367380': 0.5,  '360200': 1.2,  '465580': 3.0,  '480610': 7.0,
}

// ─── DGR 가이드 ──────────────────────────────────────────────────────────────

const DGR_GUIDE = [
  { type: '배당 귀족주 (25년+ 연속 인상)', dgr: 6,   examples: 'JNJ, KO, PG, MMM' },
  { type: '빅테크 배당 성장주',            dgr: 10,  examples: 'MSFT, AAPL' },
  { type: '경기방어 소비재',               dgr: 5,   examples: 'PEP, CL, CLX' },
  { type: '고배당 / 리츠',                dgr: 3,   examples: 'O, MAIN, T' },
  { type: 'S&P 500 역사적 평균',           dgr: 5.5, examples: '기본 권장값' },
]

// ─── 포맷 헬퍼 ───────────────────────────────────────────────────────────────

const fmtKRW = (n: number) => `₩${Math.round(n).toLocaleString()}`
const fmtUSD = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = (n: number) => `${n.toFixed(2)}%`

function fmtAmt(val: number, isKrw: boolean, usdkrw: number | null) {
  if (isKrw) return `₩${Math.round(val).toLocaleString()}`
  return fmtUSD(val)
}
function fmtSub(val: number, isKrw: boolean, usdkrw: number | null) {
  if (isKrw && usdkrw) return fmtUSD(val / usdkrw)
  if (!isKrw && usdkrw) return fmtKRW(val * usdkrw)
  return null
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

function AccumulationContent() {
  // 계좌 유형
  const [accountId, setAccountId] = useState<AccountId>('general')
  const account = ACCOUNT_TYPES.find(a => a.id === accountId)!
  const taxRate = account.rate

  // 종목 유형
  const [source, setSource] = useState<'stock' | 'us_etf' | 'kr_etf'>('stock')
  const isKrw = source === 'kr_etf'

  // 모드 탭
  const [mode, setMode] = useState<'single' | 'multi' | 'goal'>('single')

  // 원시 데이터
  const [stockData, setStockData] = useState<StockData[]>([])
  const [candidates, setCandidates] = useState<CandidateItem[]>([])
  const [customWatchlist, setCustomWatchlist] = useState<CustomItem[]>([])
  const [usEtfList, setUsEtfList] = useState<EtfItem[]>([])
  const [krEtfList, setKrEtfList] = useState<EtfItem[]>([])
  const [usdkrw, setUsdkrw] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // 단일 모드
  const [ticker, setTicker] = useState('')
  const [initShares, setInitShares] = useState(0)
  const [monthlyShares, setMonthlyShares] = useState(1)

  // 복수 모드
  const [multiSettings, setMultiSettings] = useState<Record<string, { selected: boolean; init: number; monthly: number }>>({})

  // 공통 설정
  const [years, setYears] = useState(10)
  const [dgr, setDgr] = useState(5)
  const [drip, setDrip] = useState(false)
  const [showDgrGuide, setShowDgrGuide] = useState(false)

  // 목표 역산
  const [targetKRW, setTargetKRW] = useState(300)
  const [goalTicker, setGoalTicker] = useState('')

  // ─── 데이터 패치 ────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      fetch('/api/stocks').then(r => r.json()),
      fetch('/api/candidates').then(r => r.json()).catch(() => []),
      fetch('/api/market').then(r => r.json()).catch(() => null),
      fetch('/api/etf-universe').then(r => r.json()).catch(() => ({ etfs: [] })),
      fetch('/api/kr-etf').then(r => r.json()).catch(() => ({ etfs: [] })),
    ]).then(([stocksData, candidatesData, marketData, etfData, krEtfData]) => {
      setStockData(stocksData.stocks || [])
      setCustomWatchlist(stocksData.customWatchlist || [])
      if (Array.isArray(candidatesData)) setCandidates(candidatesData)
      if (marketData?.USDKRW?.price) setUsdkrw(marketData.USDKRW.price)
      if (etfData.etfs) setUsEtfList(etfData.etfs.filter((e: EtfItem) => e.last_price && e.div_yield))
      if (krEtfData.etfs) {
        setKrEtfList(
          (krEtfData.etfs as EtfItem[])
            .map(e => ({ ...e, div_yield: e.div_yield ?? KR_MANUAL[e.ticker] ?? null }))
            .filter(e => e.last_price && e.div_yield)
        )
      }
    }).finally(() => setLoading(false))
  }, [])

  // ─── 통합 종목 목록 ──────────────────────────────────────────────────────────

  const stockMap = useMemo(
    () => Object.fromEntries(stockData.map(s => [s.ticker, s])),
    [stockData]
  )

  const mergedList = useMemo(() => {
    const seen = new Set<string>()
    const list: { ticker: string; name: string }[] = []
    for (const c of candidates.filter(c => c.status === 'watching')) {
      if (!seen.has(c.ticker)) { seen.add(c.ticker); list.push({ ticker: c.ticker, name: c.name }) }
    }
    for (const w of WATCHLIST) {
      if (!seen.has(w.ticker)) { seen.add(w.ticker); list.push({ ticker: w.ticker, name: w.name }) }
    }
    for (const c of customWatchlist) {
      if (!seen.has(c.ticker)) { seen.add(c.ticker); list.push({ ticker: c.ticker, name: c.name || c.ticker }) }
    }
    return list
  }, [candidates, customWatchlist])

  // 현재 source에 맞는 아이템 목록
  const allItems = useMemo((): AccumItem[] => {
    if (source === 'stock') {
      return mergedList
        .filter(w => stockMap[w.ticker]?.price && stockMap[w.ticker]?.div_yield)
        .map(w => ({
          ticker: w.ticker, name: w.name,
          price: stockMap[w.ticker]!.price!,
          div_yield: stockMap[w.ticker]!.div_yield!,
          currency: 'USD' as const,
        }))
    }
    if (source === 'us_etf') {
      return usEtfList.map(e => ({
        ticker: e.ticker, name: e.name,
        price: e.last_price!, div_yield: e.div_yield!,
        currency: 'USD' as const, meta: e.category,
      }))
    }
    return krEtfList.map(e => ({
      ticker: e.ticker, name: e.name,
      price: e.last_price!, div_yield: e.div_yield!,
      currency: 'KRW' as const, meta: e.issuer,
    }))
  }, [source, mergedList, stockMap, usEtfList, krEtfList])

  // source 변경 시 ticker 리셋
  useEffect(() => { setTicker(''); setGoalTicker('') }, [source])

  // multi settings 초기화
  useEffect(() => {
    setMultiSettings(prev => {
      const next = { ...prev }
      for (const item of allItems) {
        if (!(item.ticker in next)) next[item.ticker] = { selected: true, init: 0, monthly: 1 }
      }
      return next
    })
  }, [allItems])

  // ─── 단일 모드 계산 ──────────────────────────────────────────────────────────

  const selectedItem = allItems.find(i => i.ticker === ticker)

  const singleRows = useMemo(() => {
    if (!selectedItem) return []
    const { price, div_yield } = selectedItem
    let purchaseShares = initShares
    let dripShares = 0
    let invested = initShares * price
    return Array.from({ length: years }, (_, i) => {
      const y = i + 1
      purchaseShares += monthlyShares * 12
      invested += monthlyShares * 12 * price
      const totalShares = purchaseShares + dripShares
      const divPerShare = price * (div_yield / 100) * Math.pow(1 + dgr / 100, y - 1)
      const gross = totalShares * divPerShare
      const net = gross * (1 - taxRate / 100)
      if (drip) dripShares += gross / price
      return { year: y, shares: totalShares, dripShares, invested, gross, net, monthly: net / 12 }
    })
  }, [selectedItem, initShares, monthlyShares, years, dgr, drip, taxRate])

  // ─── 복수 모드 계산 ──────────────────────────────────────────────────────────

  const multiRows = useMemo(() => {
    if (mode !== 'multi') return []
    const selectedItems = allItems.filter(i => multiSettings[i.ticker]?.selected !== false)
    if (selectedItems.length === 0) return []

    const state: Record<string, { purchaseShares: number; dripShares: number; invested: number }> = {}
    for (const item of selectedItems) {
      const s = multiSettings[item.ticker] || { init: 0, monthly: 1 }
      state[item.ticker] = { purchaseShares: s.init || 0, dripShares: 0, invested: (s.init || 0) * item.price }
    }

    return Array.from({ length: years }, (_, i) => {
      const y = i + 1
      let totalGross = 0, totalNet = 0, totalInvested = 0
      const perItem: Record<string, { gross: number; net: number; shares: number }> = {}

      for (const item of selectedItems) {
        const s = multiSettings[item.ticker] || { monthly: 1, init: 0, selected: true }
        const st = state[item.ticker]
        st.purchaseShares += (s.monthly || 1) * 12
        st.invested += (s.monthly || 1) * 12 * item.price
        const totalShares = st.purchaseShares + st.dripShares
        const divPerShare = item.price * (item.div_yield / 100) * Math.pow(1 + dgr / 100, y - 1)
        const gross = totalShares * divPerShare
        const net = gross * (1 - taxRate / 100)
        if (drip) st.dripShares += gross / item.price
        totalGross += gross; totalNet += net; totalInvested += st.invested
        perItem[item.ticker] = { gross, net, shares: totalShares }
      }
      return { year: y, gross: totalGross, net: totalNet, monthly: totalNet / 12, invested: totalInvested, perItem }
    })
  }, [mode, allItems, multiSettings, years, dgr, drip, taxRate])

  // ─── 목표 역산 계산 ──────────────────────────────────────────────────────────

  const goalItem = allItems.find(i => i.ticker === goalTicker)
  const goalResult = useMemo(() => {
    if (!goalItem || !usdkrw) return null
    const { price, div_yield, currency } = goalItem
    // 목표: 매월 targetKRW 만원 (세후 KRW)
    const targetAnnualNetKRW = targetKRW * 10000 * 12
    const targetAnnualGrossKRW = targetAnnualNetKRW / (1 - taxRate / 100)
    const targetAnnualGrossUSD = targetAnnualGrossKRW / usdkrw

    const priceUSD = currency === 'KRW' ? price / usdkrw : price
    const divYieldPct = div_yield / 100
    const annualDPS_USD = priceUSD * divYieldPct
    if (annualDPS_USD <= 0) return null

    const growthFactor = Math.pow(1 + dgr / 100, years)
    const monthlySharesNeeded = Math.ceil(targetAnnualGrossUSD / (12 * years * annualDPS_USD * growthFactor))
    const monthlyInvestUSD = monthlySharesNeeded * priceUSD
    const monthlyInvestKRW = monthlySharesNeeded * price

    const rows = Array.from({ length: years }, (_, i) => {
      const y = i + 1
      const totalShares = monthlySharesNeeded * 12 * y
      const dps_USD = annualDPS_USD * Math.pow(1 + dgr / 100, y)
      const gross_USD = totalShares * dps_USD
      const net_USD = gross_USD * (1 - taxRate / 100)
      return {
        year: y,
        gross: currency === 'KRW' ? gross_USD * usdkrw : gross_USD,
        net: currency === 'KRW' ? net_USD * usdkrw : net_USD,
        monthly: currency === 'KRW' ? (net_USD * usdkrw) / 12 : net_USD / 12,
      }
    })

    return { monthlySharesNeeded, monthlyInvestUSD, monthlyInvestKRW, rows }
  }, [goalItem, usdkrw, targetKRW, years, dgr, taxRate])

  // ─── 마일스톤 ────────────────────────────────────────────────────────────────

  const activeRows = mode === 'single' ? singleRows : multiRows
  const milestoneYears = [1, 3, 5, 10, years].filter((y, i, arr) => arr.indexOf(y) === i && y <= years)

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>

  // ─── 렌더 ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A]">적립 시뮬레이션</h1>
        <p className="text-sm text-[#64748B] mt-0.5">월 구매 주수 → 연차별 배당 성장 예측 · 목표 역산</p>
      </div>

      {/* ── 계좌 유형 ── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-5">
        <p className="text-sm font-semibold text-[#0F172A] mb-3">💼 계좌 유형</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {ACCOUNT_TYPES.map(acc => (
            <button key={acc.id} onClick={() => setAccountId(acc.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                accountId === acc.id
                  ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB]'
                  : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'
              }`}>
              {acc.label}
              <span className="ml-1.5 opacity-70">{acc.rate}%</span>
              {acc.tag && <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded">절세</span>}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#64748B] bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">
          {account.note}
        </p>
        {accountId === 'isa' && (
          <p className="text-[10px] text-amber-600 mt-2 px-1">
            ⚠ 이 시뮬레이션은 9.9% 단일 세율 적용입니다. 실제 ISA는 비과세 한도(200만원) 이하 배당은 세금 0원이므로 실제 세후 수령액이 더 클 수 있습니다.
          </p>
        )}
        {accountId.startsWith('pension') && (
          <p className="text-[10px] text-emerald-600 mt-2 px-1">
            ✓ 납입 기간의 세액공제 효과(13.2~16.5%)는 별도 계산하세요. 실효 수익률이 시뮬레이션보다 높아집니다.
          </p>
        )}
      </div>

      {/* ── 종목 유형 + 공통 설정 ── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-5">
        <div className="grid grid-cols-2 gap-6">
          {/* 종목 유형 */}
          <div>
            <p className="text-xs font-semibold text-[#64748B] mb-2">종목 유형</p>
            <div className="flex gap-1.5">
              {([
                { id: 'stock',  label: '📈 개별주',     count: allItems.length },
                { id: 'us_etf', label: '🇺🇸 미국 ETF',  count: usEtfList.length },
                { id: 'kr_etf', label: '🇰🇷 국내 ETF',  count: krEtfList.length },
              ] as const).map(s => (
                <button key={s.id} onClick={() => setSource(s.id)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    source === s.id
                      ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'
                  }`}>
                  {s.label}
                  <span className="block text-[10px] opacity-60 mt-0.5">{source === s.id ? `${(source === 'stock' ? allItems : source === 'us_etf' ? usEtfList : krEtfList).length}종목` : `${s.count}종목`}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 공통 설정 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[#64748B] mb-1.5 block">투자 기간</label>
              <div className="flex items-center gap-1">
                <input type="number" min={1} max={50} value={years}
                  onChange={e => setYears(Math.max(1, Number(e.target.value)))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm text-center font-bold focus:outline-none focus:border-[#1A56DB]" />
                <span className="text-xs text-[#64748B] shrink-0">년</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#64748B] mb-1.5 block">
                DGR{' '}
                <button onClick={() => setShowDgrGuide(v => !v)}
                  className="text-[#1A56DB] font-bold text-xs hover:text-blue-700">?</button>
              </label>
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={30} step={0.5} value={dgr}
                  onChange={e => setDgr(Number(e.target.value))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm text-center font-bold focus:outline-none focus:border-[#1A56DB]" />
                <span className="text-xs text-[#64748B] shrink-0">%</span>
              </div>
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={drip} onChange={e => setDrip(e.target.checked)}
                  className="rounded accent-[#1A56DB]" />
                <span className="text-xs text-[#64748B]">DRIP 재투자</span>
              </label>
            </div>
          </div>
        </div>

        {/* DGR 가이드 */}
        {showDgrGuide && (
          <div className="mt-4 border-t border-[#E2E8F0] pt-3">
            <p className="text-xs font-semibold text-[#0F172A] mb-2">DGR 참고값 — 배당 성장률 가이드</p>
            <div className="grid grid-cols-2 gap-2">
              {DGR_GUIDE.map(g => (
                <div key={g.type} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
                  <span className="text-sm font-bold text-[#1A56DB] w-10 text-right shrink-0">{g.dgr}%</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#0F172A] truncate">{g.type}</p>
                    <p className="text-[10px] text-[#64748B]">{g.examples}</p>
                  </div>
                  <button onClick={() => { setDgr(g.dgr); setShowDgrGuide(false) }}
                    className="text-[10px] text-[#1A56DB] border border-[#1A56DB]/30 px-1.5 py-0.5 rounded hover:bg-blue-50 shrink-0">
                    적용
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 모드 탭 ── */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        {([
          { id: 'single', label: '📌 단일 종목' },
          { id: 'multi',  label: '📊 복수 종목' },
          { id: 'goal',   label: '🎯 목표 역산' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setMode(t.id)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              mode === t.id ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
          단일 종목 모드
      ════════════════════════════════════════════════════════════ */}
      {mode === 'single' && (
        <>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-5">
            <div className="grid grid-cols-3 gap-4">
              {/* 종목 선택 */}
              <div>
                <label className="text-xs text-[#64748B] mb-1.5 block">종목 선택</label>
                <select value={ticker} onChange={e => setTicker(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A56DB] bg-white">
                  <option value="">— 선택 —</option>
                  {allItems.map(item => (
                    <option key={item.ticker} value={item.ticker}>
                      {item.ticker} — {item.name.length > 18 ? item.name.slice(0, 18) + '…' : item.name}
                      {' '}({fmtPct(item.div_yield)})
                    </option>
                  ))}
                </select>
              </div>
              {/* 초기 주수 */}
              <div>
                <label className="text-xs text-[#64748B] mb-1.5 block">초기 보유 주수</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={initShares}
                    onChange={e => setInitShares(Math.max(0, Number(e.target.value)))}
                    className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-[#1A56DB]" />
                  <span className="text-xs text-[#64748B] shrink-0">주</span>
                </div>
              </div>
              {/* 월 구매 */}
              <div>
                <label className="text-xs text-[#64748B] mb-1.5 block">월 구매 주수</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={monthlyShares}
                    onChange={e => setMonthlyShares(Math.max(1, Number(e.target.value)))}
                    className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-[#1A56DB]" />
                  <span className="text-xs text-[#64748B] shrink-0">주/월</span>
                </div>
              </div>
            </div>

            {/* 선택 종목 정보 */}
            {selectedItem && (
              <div className="flex gap-6 mt-4 pt-4 border-t border-[#E2E8F0]">
                <div>
                  <p className="text-[10px] text-[#64748B]">현재가</p>
                  <p className="text-sm font-bold text-[#0F172A]">{fmtAmt(selectedItem.price, isKrw, usdkrw)}</p>
                  {fmtSub(selectedItem.price, isKrw, usdkrw) && (
                    <p className="text-[10px] text-[#64748B]">{fmtSub(selectedItem.price, isKrw, usdkrw)}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-[#64748B]">배당률</p>
                  <p className="text-sm font-bold text-emerald-600">{fmtPct(selectedItem.div_yield)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#64748B]">주당 연간 배당</p>
                  <p className="text-sm font-bold text-[#0F172A]">
                    {fmtAmt(selectedItem.price * selectedItem.div_yield / 100, isKrw, usdkrw)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#64748B]">월 투자금 ({monthlyShares}주)</p>
                  <p className="text-sm font-bold text-[#0F172A]">
                    {fmtAmt(monthlyShares * selectedItem.price, isKrw, usdkrw)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#64748B]">계좌 세율</p>
                  <p className="text-sm font-bold text-[#1A56DB]">{taxRate}%</p>
                  <p className="text-[10px] text-[#64748B]">{account.label}</p>
                </div>
              </div>
            )}
          </div>

          {/* 마일스톤 카드 */}
          {singleRows.length > 0 && (
            <div className={`grid gap-4 mb-5`} style={{ gridTemplateColumns: `repeat(${Math.min(milestoneYears.length, 5)}, 1fr)` }}>
              {milestoneYears.map(y => {
                const r = singleRows.find(r => r.year === y)
                if (!r) return null
                const isFinal = y === years
                return (
                  <div key={y} className={`rounded-xl border p-4 ${isFinal ? 'border-[#1A56DB] bg-blue-50' : 'border-[#E2E8F0] bg-white'}`}>
                    <p className="text-xs text-[#64748B] mb-0.5">{y}년차{isFinal ? ' (목표)' : ''}</p>
                    <p className={`text-lg font-bold tabular ${isFinal ? 'text-[#1A56DB]' : 'text-[#0F172A]'}`}>
                      {fmtAmt(r.net, isKrw, usdkrw)}
                    </p>
                    {fmtSub(r.net, isKrw, usdkrw) && (
                      <p className="text-xs text-[#64748B]">{fmtSub(r.net, isKrw, usdkrw)}</p>
                    )}
                    <div className="mt-2 pt-2 border-t border-[#E2E8F0] space-y-0.5">
                      <p className="text-[11px] text-[#64748B]">월 {fmtAmt(r.monthly, isKrw, usdkrw)}</p>
                      <p className="text-[11px] text-[#64748B]">{Math.round(r.shares).toLocaleString()}주</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 연차별 테이블 */}
          {singleRows.length > 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-auto max-h-[500px]">
              <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between sticky top-0 z-10">
                <p className="text-sm font-semibold text-[#0F172A]">연차별 적립 현황</p>
                <span className="text-xs text-[#64748B]">{account.label} · 세율 {taxRate}%{drip ? ' · DRIP' : ''}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs sticky top-[49px] z-10">
                    <th className="text-center px-4 py-3 font-medium text-[#64748B]">연차</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">누적 주수</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">연간배당 (세전)</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">세금</th>
                    <th className="text-right px-3 py-3 font-medium text-[#1A56DB]">연간배당 (세후)</th>
                    <th className="text-right px-4 py-3 font-medium text-[#64748B]">월평균 (세후)</th>
                    <th className="text-right px-4 py-3 font-medium text-[#64748B]">총 투자비용</th>
                  </tr>
                </thead>
                <tbody>
                  {singleRows.map((r, i) => {
                    const tax = r.gross - r.net
                    const isFinal = r.year === years
                    const isMilestone = [1, 5, 10].includes(r.year)
                    return (
                      <tr key={r.year} className={`border-b border-[#E2E8F0] last:border-0 ${isFinal ? 'bg-blue-50/70 font-semibold' : isMilestone ? 'bg-slate-50/70' : i % 2 ? 'bg-slate-50/30' : ''}`}>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-medium ${isFinal ? 'text-[#1A56DB]' : 'text-[#64748B]'}`}>{r.year}년차</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-xs">
                          {Math.round(r.shares).toLocaleString()}주
                          {drip && r.dripShares > 0 && <span className="text-emerald-600"> +{Math.round(r.dripShares)}주</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-xs text-[#64748B]">
                          <p>{fmtAmt(r.gross, isKrw, usdkrw)}</p>
                          {fmtSub(r.gross, isKrw, usdkrw) && <p className="text-[10px]">{fmtSub(r.gross, isKrw, usdkrw)}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-xs text-red-500">
                          -{fmtAmt(tax, isKrw, usdkrw)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular font-medium text-[#1A56DB]">
                          <p className="text-xs">{fmtAmt(r.net, isKrw, usdkrw)}</p>
                          {fmtSub(r.net, isKrw, usdkrw) && <p className="text-[10px] font-normal text-[#64748B]">{fmtSub(r.net, isKrw, usdkrw)}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular text-xs text-[#0F172A]">
                          <p>{fmtAmt(r.monthly, isKrw, usdkrw)}</p>
                          {fmtSub(r.monthly, isKrw, usdkrw) && <p className="text-[10px] text-[#64748B]">{fmtSub(r.monthly, isKrw, usdkrw)}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular text-xs text-[#64748B]">
                          {fmtAmt(r.invested, isKrw, usdkrw)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-8 text-center">
              <p className="text-sm text-[#64748B]">종목을 선택하면 적립 시뮬레이션이 시작됩니다.</p>
              <p className="text-xs text-slate-400 mt-1">배당률 데이터가 없는 종목은 목록에서 제외됩니다.</p>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          복수 종목 모드
      ════════════════════════════════════════════════════════════ */}
      {mode === 'multi' && (
        <>
          {/* 종목 설정 테이블 */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input type="checkbox"
                  checked={allItems.length > 0 && allItems.every(i => multiSettings[i.ticker]?.selected !== false)}
                  onChange={e => setMultiSettings(prev => {
                    const next = { ...prev }
                    for (const item of allItems) {
                      next[item.ticker] = { ...(next[item.ticker] || { init: 0, monthly: 1 }), selected: e.target.checked }
                    }
                    return next
                  })}
                  className="rounded accent-[#1A56DB] cursor-pointer" />
                <span className="text-sm font-semibold text-[#0F172A]">
                  종목 선택{' '}
                  <span className="text-xs font-normal text-[#64748B]">
                    ({allItems.filter(i => multiSettings[i.ticker]?.selected !== false).length}/{allItems.length}종목)
                  </span>
                </span>
              </div>
              <p className="text-xs text-[#64748B]">초기 보유 / 월 구매 주수 설정</p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-[#E2E8F0] text-xs">
                  <tr>
                    <th className="w-10 px-3 py-2.5" />
                    <th className="text-left px-3 py-2.5 font-medium text-[#64748B]">티커</th>
                    <th className="text-left px-3 py-2.5 font-medium text-[#64748B] min-w-[140px]">종목명</th>
                    <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">현재가</th>
                    <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">배당률</th>
                    <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">초기 주수</th>
                    <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">월 구매</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map((item, i) => {
                    const cfg = multiSettings[item.ticker] || { selected: true, init: 0, monthly: 1 }
                    const isSelected = cfg.selected !== false
                    return (
                      <tr key={item.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${!isSelected ? 'opacity-40' : i % 2 ? 'bg-slate-50/40' : ''}`}>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={isSelected}
                            onChange={e => setMultiSettings(prev => ({
                              ...prev, [item.ticker]: { ...(prev[item.ticker] || { init: 0, monthly: 1 }), selected: e.target.checked }
                            }))}
                            className="rounded accent-[#1A56DB] cursor-pointer" />
                        </td>
                        <td className="px-3 py-2 font-bold text-[#1A56DB] text-xs whitespace-nowrap">{item.ticker}</td>
                        <td className="px-3 py-2 text-[#0F172A] text-xs max-w-[160px]">
                          <span className="block truncate" title={item.name}>{item.name}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-[#0F172A] tabular whitespace-nowrap">
                          {fmtAmt(item.price, isKrw, usdkrw)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-emerald-600 tabular">{fmtPct(item.div_yield)}</td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" min={0} value={cfg.init}
                            onChange={e => setMultiSettings(prev => ({
                              ...prev, [item.ticker]: { ...(prev[item.ticker] || { selected: true, monthly: 1 }), init: Math.max(0, Number(e.target.value)) }
                            }))}
                            className="w-16 border border-[#E2E8F0] rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-[#1A56DB]" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" min={1} value={cfg.monthly}
                            onChange={e => setMultiSettings(prev => ({
                              ...prev, [item.ticker]: { ...(prev[item.ticker] || { selected: true, init: 0 }), monthly: Math.max(1, Number(e.target.value)) }
                            }))}
                            className="w-16 border border-[#E2E8F0] rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-[#1A56DB]" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 마일스톤 카드 - multi */}
          {multiRows.length > 0 && (
            <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: `repeat(${Math.min(milestoneYears.length, 5)}, 1fr)` }}>
              {milestoneYears.map(y => {
                const r = multiRows.find(r => r.year === y)
                if (!r) return null
                const isFinal = y === years
                return (
                  <div key={y} className={`rounded-xl border p-4 ${isFinal ? 'border-[#1A56DB] bg-blue-50' : 'border-[#E2E8F0] bg-white'}`}>
                    <p className="text-xs text-[#64748B] mb-0.5">{y}년차{isFinal ? ' (목표)' : ''}</p>
                    <p className={`text-lg font-bold tabular ${isFinal ? 'text-[#1A56DB]' : 'text-[#0F172A]'}`}>
                      {fmtAmt(r.net, isKrw, usdkrw)}
                    </p>
                    {fmtSub(r.net, isKrw, usdkrw) && <p className="text-xs text-[#64748B]">{fmtSub(r.net, isKrw, usdkrw)}</p>}
                    <p className="text-[11px] text-[#64748B] mt-2">월 {fmtAmt(r.monthly, isKrw, usdkrw)}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* 연차별 테이블 - multi */}
          {multiRows.length > 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-auto max-h-[500px]">
              <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50 sticky top-0 z-10 flex justify-between items-center">
                <p className="text-sm font-semibold text-[#0F172A]">
                  연차별 합산 현황{' '}
                  <span className="text-xs font-normal text-[#64748B]">
                    ({allItems.filter(i => multiSettings[i.ticker]?.selected !== false).length}종목)
                  </span>
                </p>
                <span className="text-xs text-[#64748B]">{account.label} · 세율 {taxRate}%</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs sticky top-[49px] z-10">
                    <th className="text-center px-4 py-3 font-medium text-[#64748B]">연차</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">연간배당 (세전)</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">세금</th>
                    <th className="text-right px-3 py-3 font-medium text-[#1A56DB]">연간배당 (세후)</th>
                    <th className="text-right px-4 py-3 font-medium text-[#64748B]">월평균 (세후)</th>
                    <th className="text-right px-4 py-3 font-medium text-[#64748B]">총 투자비용</th>
                  </tr>
                </thead>
                <tbody>
                  {multiRows.map((r, i) => {
                    const tax = r.gross - r.net
                    const isFinal = r.year === years
                    return (
                      <tr key={r.year} className={`border-b border-[#E2E8F0] last:border-0 ${isFinal ? 'bg-blue-50/70 font-semibold' : i % 2 ? 'bg-slate-50/30' : ''}`}>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-medium ${isFinal ? 'text-[#1A56DB]' : 'text-[#64748B]'}`}>{r.year}년차</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-xs text-[#64748B]">{fmtAmt(r.gross, isKrw, usdkrw)}</td>
                        <td className="px-3 py-2.5 text-right tabular text-xs text-red-500">-{fmtAmt(tax, isKrw, usdkrw)}</td>
                        <td className="px-3 py-2.5 text-right tabular font-medium text-[#1A56DB]">
                          <p className="text-xs">{fmtAmt(r.net, isKrw, usdkrw)}</p>
                          {fmtSub(r.net, isKrw, usdkrw) && <p className="text-[10px] font-normal text-[#64748B]">{fmtSub(r.net, isKrw, usdkrw)}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular text-xs text-[#0F172A]">{fmtAmt(r.monthly, isKrw, usdkrw)}</td>
                        <td className="px-4 py-2.5 text-right tabular text-xs text-[#64748B]">{fmtAmt(r.invested, isKrw, usdkrw)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-8 text-center">
              <p className="text-sm text-[#64748B]">종목을 선택하면 시뮬레이션이 시작됩니다.</p>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          목표 역산 모드
      ════════════════════════════════════════════════════════════ */}
      {mode === 'goal' && (
        <>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-5">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-[#64748B] mb-1.5 block">목표 월 배당 (세후)</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={targetKRW} min={1} step={10}
                    onChange={e => setTargetKRW(Number(e.target.value))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#1A56DB]" />
                  <span className="text-xs text-[#64748B] shrink-0">만원</span>
                </div>
                {usdkrw && <p className="text-[10px] text-[#64748B] mt-1">≈ {fmtUSD((targetKRW * 10000) / usdkrw)}/월</p>}
              </div>
              <div>
                <label className="text-xs text-[#64748B] mb-1.5 block">투자 기간</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={years} min={1} max={50}
                    onChange={e => setYears(Number(e.target.value))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#1A56DB]" />
                  <span className="text-xs text-[#64748B] shrink-0">년</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#64748B] mb-1.5 block">DGR (%)</label>
                <input type="number" value={dgr} min={0} max={30} step={0.5}
                  onChange={e => setDgr(Number(e.target.value))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#1A56DB]" />
              </div>
              <div>
                <label className="text-xs text-[#64748B] mb-1.5 block">종목 선택</label>
                <select value={goalTicker} onChange={e => setGoalTicker(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A56DB] bg-white">
                  <option value="">— 선택 —</option>
                  {allItems.map(item => (
                    <option key={item.ticker} value={item.ticker}>
                      {item.ticker} ({fmtPct(item.div_yield)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {goalResult ? (
            <>
              {/* 결과 요약 */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="bg-[#1A56DB] rounded-xl p-4 text-white">
                  <p className="text-xs opacity-80 mb-1">월 구매 필요 주수</p>
                  <p className="text-2xl font-bold tabular">{goalResult.monthlySharesNeeded.toLocaleString()}주</p>
                  <p className="text-xs opacity-70 mt-0.5">{years}년 매월 구매 기준</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                  <p className="text-xs text-[#64748B] mb-1">월 투자 금액</p>
                  <p className="text-xl font-bold tabular text-[#0F172A]">
                    {isKrw ? fmtKRW(goalResult.monthlyInvestKRW) : fmtUSD(goalResult.monthlyInvestUSD)}
                  </p>
                  {isKrw && usdkrw && <p className="text-xs text-[#64748B] mt-0.5">{fmtUSD(goalResult.monthlyInvestKRW / usdkrw)}/월</p>}
                  {!isKrw && usdkrw && <p className="text-xs text-[#64748B] mt-0.5">{fmtKRW(goalResult.monthlyInvestUSD * usdkrw)}/월</p>}
                </div>
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                  <p className="text-xs text-[#64748B] mb-1">총 투자 비용 ({years}년)</p>
                  <p className="text-xl font-bold tabular text-[#0F172A]">
                    {isKrw ? fmtKRW(goalResult.monthlyInvestKRW * 12 * years) : fmtUSD(goalResult.monthlyInvestUSD * 12 * years)}
                  </p>
                  <p className="text-xs text-[#64748B] mt-0.5">{account.label} 세율 {taxRate}%</p>
                </div>
              </div>

              {/* 연차별 달성 테이블 */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-auto max-h-[500px]">
                <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50 sticky top-0 z-10 flex justify-between items-center">
                  <p className="text-sm font-semibold text-[#0F172A]">연도별 배당 달성 예측</p>
                  <p className="text-xs text-[#64748B]">목표 <span className="font-semibold text-[#0F172A]">{fmtKRW(targetKRW * 10000)}/월</span> (세후)</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs sticky top-[49px] z-10">
                      <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">연도</th>
                      <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">연간배당 (세전)</th>
                      <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">연간배당 (세후)</th>
                      <th className="text-right px-3 py-2.5 font-medium text-[#1A56DB]">월평균 (세후)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goalResult.rows.map((r, i) => {
                      const isGoalYear = r.year === years
                      const monthlyKRW = isKrw ? r.monthly : usdkrw ? r.monthly * usdkrw : 0
                      const isReached = monthlyKRW >= targetKRW * 10000
                      return (
                        <tr key={r.year} className={`border-b border-[#E2E8F0] last:border-0 ${isGoalYear ? 'bg-blue-50/70 font-semibold' : i % 2 ? 'bg-slate-50/30' : ''}`}>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-medium ${isGoalYear ? 'text-[#1A56DB]' : 'text-[#64748B]'}`}>
                              {r.year}년차
                              {isReached && !isGoalYear && <span className="ml-1 text-emerald-600 text-[10px]">✓</span>}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular text-xs text-[#64748B]">
                            {fmtAmt(r.gross, isKrw, usdkrw)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular text-xs text-[#64748B]">
                            {fmtAmt(r.net, isKrw, usdkrw)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular font-medium text-[#1A56DB]">
                            <p className="text-xs">{fmtAmt(r.monthly, isKrw, usdkrw)}</p>
                            <p className={`text-[10px] font-normal ${isReached ? 'text-emerald-600 font-bold' : 'text-[#64748B]'}`}>
                              {fmtKRW(monthlyKRW)}{isReached ? ' ✓' : ''}
                            </p>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-8 text-center">
              <p className="text-sm text-[#64748B]">종목을 선택하면 역산 결과가 표시됩니다.</p>
              <p className="text-xs text-slate-400 mt-1">배당률 데이터가 없는 종목은 계산에서 제외됩니다.</p>
            </div>
          )}
        </>
      )}

      {/* 면책 문구 */}
      <p className="text-[10px] text-slate-400 mt-6 leading-relaxed">
        * 주가·배당률은 최근 수집 기준이며 실시간 시세가 아닙니다. DGR은 가정치로 실제 배당은 변동됩니다.<br />
        * ISA 비과세 한도(200만원/년)와 연금저축 세액공제 효과는 이 시뮬레이션에 반영되지 않습니다. 실제 세후 수령액은 더 클 수 있습니다.<br />
        * 연금저축·IRP 중도해지 시 기타소득세 16.5% 적용. 의무 가입 조건 확인 필수.
      </p>
    </div>
  )
}

export default function AccumulationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[#64748B]">불러오는 중...</div>}>
      <AccumulationContent />
    </Suspense>
  )
}
