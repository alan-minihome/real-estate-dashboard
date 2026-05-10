'use client'
import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { WATCHLIST } from '@/lib/watchlist'
import KumyungTaxBanner from '../components/KumyungTaxBanner'

// ─── 타입 ───────────────────────────────────────────────────────────────────

interface TaxAccount {
  id: string; label: string; rate: number
  description: string; law_basis: string; source_label: string; source_url: string
}
interface TaxConfig {
  accounts: TaxAccount[]
  verified_at: string
  note: string
}
interface TaxHistory {
  id: number
  updated_at: string
  accounts: TaxAccount[]
  verified_at: string
  note: string
}
interface StockData {
  ticker: string; price: number | null; div_yield: number | null; div_yield_5y: number | null
}
interface Screening { ticker: string; overall_pass: number; buy_signal: number }
interface PortfolioRow {
  ticker: string; name: string; quantity: number; avg_price: number
  current_price: number | null; eval_amount: number | null
}
interface CustomItem { ticker: string; name: string }
interface EtfSimItem {
  ticker: string; name: string; div_yield: number | null; last_price: number | null
  category?: string; issuer?: string; us_equiv?: string; div_frequency?: string | null
}

// ─── 포맷 헬퍼 ──────────────────────────────────────────────────────────────

const fmtKRW = (n: number) => `₩${Math.round(n).toLocaleString()}`
const fmtUSD = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = (n: number) => `${n.toFixed(2)}%`

// ─── 세금 설정 패널 ──────────────────────────────────────────────────────────

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function TaxPanel({
  config, onSave,
}: {
  config: TaxConfig | null
  onSave: (c: TaxConfig) => void
}) {
  const [mode, setMode] = useState<'closed' | 'edit' | 'history'>('closed')
  const [draft, setDraft] = useState<TaxConfig | null>(null)
  const [history, setHistory] = useState<TaxHistory[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function startEdit() {
    setDraft(config ? JSON.parse(JSON.stringify(config)) : null)
    setMsg('')
    setMode('edit')
  }

  async function openHistory() {
    setMode('history')
    const r = await fetch('/api/tax-config/history')
    const d = await r.json()
    if (Array.isArray(d)) setHistory(d)
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    const updated = { ...draft, verified_at: new Date().toISOString().slice(0, 10) }
    const r = await fetch('/api/tax-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    const d = await r.json()
    if (d.ok) {
      onSave(updated)
      setMsg('저장 완료')
      setMode('closed')
    } else {
      setMsg(`실패: ${d.error}`)
    }
    setSaving(false)
  }

  if (!config) return null

  const days = daysSince(config.verified_at)
  const isOverdue = days >= 30
  const isWarning = days >= 20 && days < 30

  return (
    <div className={`mb-6 bg-white rounded-xl border overflow-hidden ${isOverdue ? 'border-red-300' : isWarning ? 'border-amber-300' : 'border-[#E2E8F0]'}`}>
      {/* 헤더 */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#0F172A]">⚖️ 세금 설정</span>
          {/* 갱신 상태 배지 */}
          {isOverdue ? (
            <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
              🔴 {days}일 경과 — 월 1회 확인 필요
            </span>
          ) : isWarning ? (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
              🟡 {days}일 경과 — 곧 확인 필요
            </span>
          ) : (
            <span className="text-xs text-[#64748B]">마지막 확인 {config.verified_at} ({days}일 전)</span>
          )}
          <a href="https://www.nts.go.kr" target="_blank" rel="noopener"
            className="text-xs text-[#1A56DB] hover:underline">국세청 →</a>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => mode === 'history' ? setMode('closed') : openHistory()}
            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${mode === 'history' ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'}`}
          >
            🕘 변경 이력
          </button>
          <button
            onClick={() => mode === 'edit' ? setMode('closed') : startEdit()}
            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${mode === 'edit' ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'}`}
          >
            ✏️ 세율 편집
          </button>
        </div>
      </div>

      {/* 현재 세율 요약 (항상 표시) */}
      <div className="px-5 pb-4 flex gap-3">
        {config.accounts.filter(a => a.id !== 'custom').map(acc => (
          <div key={acc.id} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-1.5">
            <span className="text-xs text-[#64748B]">{acc.label}</span>
            <span className="text-sm font-bold text-[#1A56DB]">{acc.rate}%</span>
          </div>
        ))}
      </div>

      {/* 편집 패널 */}
      {mode === 'edit' && draft && (
        <div className="border-t border-[#E2E8F0] px-5 pb-5">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4 mb-4">
            ⚠️ {config.note}
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {draft.accounts.map((acc, i) => (
              <div key={acc.id} className="bg-slate-50 rounded-xl p-4 border border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#0F172A]">{acc.label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" step="0.1" min="0" max="100" value={acc.rate}
                      onChange={e => {
                        const next = [...draft.accounts]
                        next[i] = { ...acc, rate: Number(e.target.value) }
                        setDraft({ ...draft, accounts: next })
                      }}
                      className="w-16 text-right text-sm font-bold text-[#1A56DB] border border-[#E2E8F0] rounded px-2 py-1 focus:outline-none focus:border-[#1A56DB]"
                    />
                    <span className="text-sm text-[#64748B]">%</span>
                  </div>
                </div>
                <p className="text-xs text-[#64748B] mb-1">{acc.description}</p>
                <p className="text-[10px] text-slate-400">근거: {acc.law_basis}</p>
                {acc.source_url && (
                  <a href={acc.source_url} target="_blank" rel="noopener"
                    className="text-[10px] text-[#1A56DB] hover:underline">{acc.source_label} →</a>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            {msg && <p className="text-xs text-emerald-600">{msg}</p>}
            <button onClick={() => setMode('closed')}
              className="px-3 py-2 text-xs border border-[#E2E8F0] text-[#64748B] rounded-lg hover:bg-slate-50">
              취소
            </button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 text-xs bg-[#1A56DB] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? '저장 중...' : '확인 완료 · 저장'}
            </button>
          </div>
        </div>
      )}

      {/* 변경 이력 패널 */}
      {mode === 'history' && (
        <div className="border-t border-[#E2E8F0]">
          {history.length === 0 ? (
            <p className="text-sm text-[#64748B] px-5 py-6 text-center">저장 이력이 없습니다.</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0] max-h-80 overflow-y-auto">
              {history.map((h, i) => {
                const prev = history[i + 1]
                return (
                  <div key={h.id} className="px-5 py-3 flex items-start gap-4">
                    <div className="w-28 shrink-0">
                      {i === 0 && (
                        <span className="text-[10px] bg-[#1A56DB] text-white px-1.5 py-0.5 rounded-full block mb-1 w-fit">최신</span>
                      )}
                      <p className="text-xs font-medium text-[#0F172A]">
                        {new Date(h.updated_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-[#64748B]">
                        {new Date(h.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-1">
                      {h.accounts.filter(a => a.id !== 'custom').map(acc => {
                        const prevAcc = prev?.accounts.find(a => a.id === acc.id)
                        const changed = prevAcc && prevAcc.rate !== acc.rate
                        return (
                          <div key={acc.id}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${changed ? 'bg-amber-100 border border-amber-300' : 'bg-slate-50 border border-[#E2E8F0]'}`}>
                            <span className="text-[#64748B]">{acc.label}</span>
                            <span className={`font-bold ${changed ? 'text-amber-700' : 'text-[#1A56DB]'}`}>{acc.rate}%</span>
                            {changed && prevAcc && (
                              <span className="text-[10px] text-slate-400">← {prevAcc.rate}%</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 결과 요약 카드 ──────────────────────────────────────────────────────────

function SummaryCards({ annual, monthly, tax, usdkrw, investment }: {
  annual: number; monthly: number; tax: number; usdkrw: number | null; investment: number
}) {
  const yieldOnCost = investment > 0 ? (annual / investment) * 100 : 0
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {[
        { label: '연간 배당 (세전)', usd: annual + tax, sub: usdkrw ? fmtKRW((annual + tax) * usdkrw) : null },
        { label: '세금 차감', usd: -tax, sub: usdkrw ? `-${fmtKRW(tax * usdkrw)}` : null, neg: true },
        { label: '연간 배당 (세후)', usd: annual, sub: usdkrw ? fmtKRW(annual * usdkrw) : null, accent: true },
      ].map(card => (
        <div key={card.label} className={`rounded-xl border p-4 ${card.accent ? 'border-[#1A56DB] bg-blue-50' : 'border-[#E2E8F0] bg-white'}`}>
          <p className="text-xs text-[#64748B] mb-1">{card.label}</p>
          <p className={`text-xl font-bold tabular ${card.accent ? 'text-[#1A56DB]' : card.neg ? 'text-red-600' : 'text-[#0F172A]'}`}>
            {card.neg ? '-' : ''}{fmtUSD(Math.abs(card.usd))}
          </p>
          {card.sub && <p className="text-xs text-[#64748B] mt-0.5">{card.sub}</p>}
        </div>
      ))}
      <div className="col-span-3 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B] mb-1">월평균 (세후)</p>
          <p className="text-xl font-bold tabular text-[#0F172A]">{fmtUSD(monthly)}</p>
          {usdkrw && <p className="text-xs text-[#64748B] mt-0.5">{fmtKRW(monthly * usdkrw)}</p>}
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B] mb-1">일평균 (세후)</p>
          <p className="text-xl font-bold tabular text-[#0F172A]">{fmtUSD(annual / 365)}</p>
          {usdkrw && <p className="text-xs text-[#64748B] mt-0.5">{fmtKRW((annual / 365) * usdkrw)}</p>}
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B] mb-1">총 매입비용</p>
          <p className="text-xl font-bold tabular text-[#0F172A]">{fmtUSD(investment)}</p>
          {usdkrw && <p className="text-xs text-[#64748B] mt-0.5">{fmtKRW(investment * usdkrw)}</p>}
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B] mb-1">실효 배당 수익률</p>
          <p className="text-xl font-bold tabular text-emerald-600">{yieldOnCost.toFixed(2)}%</p>
          <p className="text-xs text-[#64748B] mt-0.5">세후 연간 / 매입비용</p>
        </div>
      </div>
    </div>
  )
}

// ─── 국내 ETF 수동 수익률 (yfinance KRX 데이터 보완) ─────────────────────────
const KR_ETF_MANUAL: Record<string, { yield_pct: number }> = {
  '458730': { yield_pct: 3.2 },  // KODEX 미국배당다우존스
  '458760': { yield_pct: 3.1 },  // TIGER 미국배당다우존스
  '429000': { yield_pct: 2.0 },  // KODEX 미국S&P500배당귀족
  '429050': { yield_pct: 2.1 },  // TIGER 미국S&P500배당귀족
  '469100': { yield_pct: 8.5 },  // KODEX 미국배당프리미엄액티브
  '476550': { yield_pct: 7.2 },  // TIGER 미국배당+7%프리미엄다우존스
  '437080': { yield_pct: 11.8 }, // TIGER 미국나스닥100커버드콜
  '133690': { yield_pct: 0.5 },  // TIGER 미국나스닥100
  '379800': { yield_pct: 0.3 },  // KODEX 미국나스닥100TR
  '360750': { yield_pct: 1.2 },  // TIGER 미국S&P500
  '379810': { yield_pct: 1.1 },  // KODEX 미국S&P500
  '251340': { yield_pct: 1.0 },  // TIGER 미국전체주식시장
  '352560': { yield_pct: 3.5 },  // KODEX 미국리츠
  '492580': { yield_pct: 3.8 },  // TIGER 미국고배당
  '367380': { yield_pct: 0.5 },  // ACE 미국나스닥100
  '360200': { yield_pct: 1.2 },  // ACE 미국S&P500
  '465580': { yield_pct: 3.0 },  // ACE 미국배당다우존스
  '480610': { yield_pct: 7.0 },  // ACE 미국배당+7%프리미엄다우존스
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

function SimulationContent() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'watchlist' | 'portfolio' | 'etf'>('watchlist')
  const [taxConfig, setTaxConfig] = useState<TaxConfig | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState('general')
  const [customRate, setCustomRate] = useState(0)
  const [stockData, setStockData] = useState<StockData[]>([])
  const [screening, setScreening] = useState<Screening[]>([])
  const [customWatchlist, setCustomWatchlist] = useState<CustomItem[]>([])
  const [candidatesList, setCandidatesList] = useState<Array<{ ticker: string; name: string; status: string; price?: number | null; div_yield?: number | null; overall_pass?: number | null; buy_signal?: number | null }>>([])
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([])
  const [usdkrw, setUsdkrw] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromCandidates, setFromCandidates] = useState(false)

  // ETF 시뮬레이션 상태
  const [usEtfList, setUsEtfList] = useState<EtfSimItem[]>([])
  const [krEtfList, setKrEtfList] = useState<EtfSimItem[]>([])
  const [etfShares, setEtfShares] = useState<Record<string, number>>({})
  const [etfSubTab, setEtfSubTab] = useState<'us' | 'kr'>('us')

  // 감시 종목 탭: 주수 입력
  const [globalShares, setGlobalShares] = useState(10)
  const [perStock, setPerStock] = useState<Record<string, number>>({})
  const [usePerStock, setUsePerStock] = useState(false)
  const [showAll, setShowAll] = useState(false)
  // 선택 제외 티커 (기본 전체 선택, 제외한 것만 추적)
  const [deselectedTickers, setDeselectedTickers] = useState<Set<string>>(new Set())


  useEffect(() => {
    // 예비 후보함에서 넘어온 경우: ?candidates=MSFT:10,AAPL:5
    const candidatesParam = searchParams.get('candidates')
    if (candidatesParam) {
      const parsed: Record<string, number> = {}
      const deselected = new Set<string>() // 후보함 종목만 선택하기 위해 나머지 제외
      candidatesParam.split(',').forEach(seg => {
        const [ticker, sharesStr] = seg.split(':')
        if (ticker) parsed[ticker.toUpperCase()] = parseInt(sharesStr || '10', 10)
      })
      setPerStock(parsed)
      setUsePerStock(true)
      setShowAll(true)
      setFromCandidates(true)
      // 후보함 종목 외에는 deselect
      const candidateTickers = new Set(Object.keys(parsed))
      // deselectedTickers는 후보함 종목이 아닌 것들 — 나중에 stockData 로드 후 적용
      setDeselectedTickers(new Set()) // 일단 전체 선택, 이후 useEffect에서 처리
      // 후보함 종목만 남기고 나머지 deselect하는 건 stockData 로드 후 수행
      ;(window as Window & { _candidateTickers?: Set<string> })._candidateTickers = candidateTickers
    }

    Promise.all([
      fetch('/api/tax-config').then(r => r.json()),
      fetch('/api/stocks').then(r => r.json()),
      fetch('/api/portfolio').then(r => r.json()),
      fetch('/api/market').then(r => r.json()).catch(() => null),
      fetch('/api/candidates').then(r => r.json()).catch(() => []),
      fetch('/api/etf-universe').then(r => r.json()).catch(() => ({ etfs: [] })),
      fetch('/api/kr-etf').then(r => r.json()).catch(() => ({ etfs: [] })),
    ]).then(([tc, stocksData, portData, marketData, candidatesData, etfData, krEtfData]) => {
      setTaxConfig(tc)
      setStockData(stocksData.stocks || [])
      setScreening(stocksData.screening || [])
      setCustomWatchlist(stocksData.customWatchlist || [])
      setPortfolio(Array.isArray(portData) ? portData : [])
      if (Array.isArray(candidatesData)) setCandidatesList(candidatesData)
      if (marketData?.USDKRW?.price) setUsdkrw(marketData.USDKRW.price)
      // ETF 데이터
      if (etfData.etfs) setUsEtfList(etfData.etfs.filter((e: EtfSimItem) => e.last_price && e.div_yield))
      if (krEtfData.etfs) {
        const merged = (krEtfData.etfs as EtfSimItem[]).map((e: EtfSimItem) => ({
          ...e,
          div_yield: e.div_yield ?? KR_ETF_MANUAL[e.ticker]?.yield_pct ?? null,
          last_price: e.last_price ?? null,
        })).filter(e => e.last_price && e.div_yield)
        setKrEtfList(merged)
      }
      // 후보함 모드: 후보함에 없는 종목은 deselect
      if (candidatesParam) {
        const candidateTickers = new Set(
          candidatesParam.split(',').map(s => s.split(':')[0].toUpperCase()).filter(Boolean)
        )
        const allTickers = [
          ...WATCHLIST.map(w => w.ticker),
          ...(stocksData.customWatchlist || []).map((c: CustomItem) => c.ticker),
        ]
        const toDeselect = new Set(allTickers.filter(t => !candidateTickers.has(t)))
        setDeselectedTickers(toDeselect)
      }
    }).finally(() => setLoading(false))
  }, [searchParams])

  // 현재 적용 세율
  const taxRate = useMemo(() => {
    if (!taxConfig) return 15.4
    const acc = taxConfig.accounts.find(a => a.id === selectedAccountId)
    if (!acc) return 15.4
    return acc.id === 'custom' ? customRate : acc.rate
  }, [taxConfig, selectedAccountId, customRate])

  const stockMap: Record<string, StockData> = Object.fromEntries(stockData.map(s => [s.ticker, s]))
  const screenMap: Record<string, Screening> = Object.fromEntries(screening.map(s => [s.ticker, s]))

  // candidates 데이터로 stockMap·screenMap 보충 (universe_screening 폴백 응답)
  for (const c of candidatesList) {
    if (!stockMap[c.ticker] && c.price) {
      stockMap[c.ticker] = { ticker: c.ticker, price: c.price, div_yield: c.div_yield ?? null, div_yield_5y: null }
    }
    if (!screenMap[c.ticker] && c.overall_pass !== undefined && c.overall_pass !== null) {
      screenMap[c.ticker] = { ticker: c.ticker, overall_pass: c.overall_pass, buy_signal: c.buy_signal ?? 0 }
    }
  }

  // 감시 종목 탭 = 후보함(watching) + WATCHLIST + customWatchlist 통합
  const watching = candidatesList.filter(c => c.status === 'watching')
  const seen = new Set<string>()
  const mergedList: Array<{ ticker: string; name: string; isCustom: boolean }> = []
  for (const c of watching) {
    if (seen.has(c.ticker)) continue
    seen.add(c.ticker)
    mergedList.push({ ticker: c.ticker, name: c.name, isCustom: false })
  }
  for (const w of WATCHLIST) {
    if (seen.has(w.ticker)) continue
    seen.add(w.ticker)
    mergedList.push({ ticker: w.ticker, name: w.name, isCustom: false })
  }
  for (const c of customWatchlist) {
    if (seen.has(c.ticker)) continue
    seen.add(c.ticker)
    mergedList.push({ ticker: c.ticker, name: c.name || c.ticker, isCustom: true })
  }

  const watchlistRows = mergedList
    .filter(w => showAll || screenMap[w.ticker]?.overall_pass === 1)
    .map(w => {
      const s = stockMap[w.ticker]
      const shares = usePerStock ? (perStock[w.ticker] ?? globalShares) : globalShares
      const annualGross = s?.price && s?.div_yield ? s.price * (s.div_yield / 100) * shares : 0
      const annualNet = annualGross * (1 - taxRate / 100)
      const taxAmount = annualGross - annualNet
      return { ...w, s, shares, annualGross, annualNet, taxAmount }
    })

  const wlTotals = watchlistRows.reduce(
    (acc, r) => ({ gross: acc.gross + r.annualGross, net: acc.net + r.annualNet, tax: acc.tax + r.taxAmount }),
    { gross: 0, net: 0, tax: 0 }
  )

  // 선택된 종목만 합산
  const selectedRows = watchlistRows.filter(r => !deselectedTickers.has(r.ticker))
  const selectedTotals = selectedRows.reduce(
    (acc, r) => ({ gross: acc.gross + r.annualGross, net: acc.net + r.annualNet, tax: acc.tax + r.taxAmount }),
    { gross: 0, net: 0, tax: 0 }
  )
  const allSelected = watchlistRows.every(r => !deselectedTickers.has(r.ticker))
  const selectedCount = selectedRows.length
  const selectedInvestment = selectedRows.reduce(
    (acc, r) => acc + (r.s?.price ?? 0) * r.shares,
    0
  )

  // 포트폴리오 탭 데이터
  const portfolioRows = portfolio.map(p => {
    const s = stockMap[p.ticker]
    const divYield = s?.div_yield
    const price = s?.price ?? p.current_price ?? p.avg_price
    const annualGross = price && divYield ? price * (divYield / 100) * p.quantity : 0
    const annualNet = annualGross * (1 - taxRate / 100)
    return { ...p, divYield, price, annualGross, annualNet, taxAmount: annualGross - annualNet }
  }).filter(p => p.annualGross > 0)

  const ptTotals = portfolioRows.reduce(
    (acc, r) => ({ gross: acc.gross + r.annualGross, net: acc.net + r.annualNet, tax: acc.tax + r.taxAmount }),
    { gross: 0, net: 0, tax: 0 }
  )


  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>

  const selectedAcc = taxConfig?.accounts.find(a => a.id === selectedAccountId)

  return (
    <div className="max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A]">배당 시뮬레이션</h1>
        <p className="text-sm text-[#64748B] mt-0.5">주수 입력 → 연간 세후 배당 수익 계산</p>
      </div>

      {/* 예비 후보함에서 불러온 경우 배너 */}
      {fromCandidates && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <span>📋</span>
            <span>예비 후보함에서 불러왔습니다. 후보 종목의 목표 주수가 자동으로 적용됐습니다.</span>
          </div>
          <a href="/candidates" className="text-xs text-emerald-600 hover:underline">← 후보함으로</a>
        </div>
      )}

      {/* 세금 설정 패널 */}
      <TaxPanel config={taxConfig} onSave={setTaxConfig} />

      {/* 계좌 유형 + 세율 선택 */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-6">
        <p className="text-sm font-semibold text-[#0F172A] mb-3">계좌 유형 선택</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {taxConfig?.accounts.map(acc => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectedAccountId === acc.id
                  ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB]'
                  : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'
              }`}
            >
              {acc.label}
              {acc.id !== 'custom' && <span className="ml-1.5 text-xs opacity-70">{acc.rate}%</span>}
            </button>
          ))}
        </div>
        {selectedAcc && (
          <div className="flex items-start gap-3 bg-slate-50 rounded-lg px-4 py-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#0F172A] mb-0.5">
                적용 세율:{' '}
                <span className="text-[#1A56DB]">
                  {selectedAcc.id === 'custom' ? customRate : selectedAcc.rate}%
                </span>
              </p>
              <p className="text-xs text-[#64748B]">{selectedAcc.description}</p>
              {selectedAcc.law_basis && (
                <p className="text-[10px] text-slate-400 mt-0.5">근거: {selectedAcc.law_basis}</p>
              )}
              {selectedAcc.source_url && (
                <a href={selectedAcc.source_url} target="_blank" rel="noopener"
                  className="text-[10px] text-[#1A56DB] hover:underline">{selectedAcc.source_label} 공식 페이지 →</a>
              )}
            </div>
            {selectedAcc.id === 'custom' && (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number" step="0.1" min="0" max="100" value={customRate}
                  onChange={e => setCustomRate(Number(e.target.value))}
                  className="w-16 text-right border border-[#E2E8F0] rounded px-2 py-1 text-sm font-bold text-[#1A56DB] focus:outline-none focus:border-[#1A56DB]"
                />
                <span className="text-sm text-[#64748B]">%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        {([
          { id: 'watchlist', label: '📋 감시 종목' },
          { id: 'portfolio', label: '💼 포트폴리오' },
          { id: 'etf', label: '🏦 ETF 시뮬' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              tab === t.id ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 감시 종목 탭 ── */}
      {tab === 'watchlist' && (
        <>
          {/* 주수 설정 */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[#0F172A]">주수 설정</p>
              <label className="flex items-center gap-2 text-xs text-[#64748B] cursor-pointer">
                <input type="checkbox" checked={usePerStock} onChange={e => setUsePerStock(e.target.checked)}
                  className="rounded accent-[#1A56DB]" />
                종목별 개별 입력
              </label>
            </div>
            {!usePerStock ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#64748B]">모든 종목</span>
                <input
                  type="number" min="1" value={globalShares}
                  onChange={e => setGlobalShares(Math.max(1, Number(e.target.value)))}
                  className="w-24 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:border-[#1A56DB]"
                />
                <span className="text-sm text-[#64748B]">주씩 구매</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {mergedList.map(w => (
                  <div key={w.ticker} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-bold text-[#1A56DB] w-14">{w.ticker}</span>
                    <input
                      type="number" min="0"
                      value={perStock[w.ticker] ?? globalShares}
                      onChange={e => setPerStock(prev => ({ ...prev, [w.ticker]: Number(e.target.value) }))}
                      className="flex-1 border border-[#E2E8F0] rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-[#1A56DB]"
                    />
                    <span className="text-xs text-[#64748B]">주</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 요약 카드 */}
          <SummaryCards
            annual={selectedTotals.net} monthly={selectedTotals.net / 12}
            tax={selectedTotals.tax} usdkrw={usdkrw} investment={selectedInvestment}
          />

          {/* 금융소득종합과세 경고 */}
          <div className="mb-6">
            <KumyungTaxBanner annualGrossUsd={selectedTotals.gross} usdkrw={usdkrw} />
          </div>

          {/* 결과 테이블 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                종목별 상세{' '}
                <span className="text-xs font-normal text-[#64748B]">
                  ({selectedCount}/{watchlistRows.length}종목 선택, 세율 {taxRate}%)
                </span>
              </h2>
              <label className="flex items-center gap-2 text-xs text-[#64748B] cursor-pointer">
                <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
                전체 보기 (미통과 포함)
              </label>
            </div>
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-auto max-h-[600px]">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs sticky top-0 z-20">
                    <th className="px-3 py-3 w-8 sticky left-0 z-30 bg-slate-50">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => {
                          if (allSelected) {
                            setDeselectedTickers(new Set(watchlistRows.map(r => r.ticker)))
                          } else {
                            setDeselectedTickers(new Set())
                          }
                        }}
                        className="rounded accent-[#1A56DB] cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B] sticky left-8 z-30 bg-slate-50 border-r border-[#E2E8F0]">티커</th>
                    <th className="text-left px-4 py-3 font-medium text-[#64748B] min-w-[140px]">종목명</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">현재가</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">배당률</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">주수</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">연간배당 (세전)</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">세금</th>
                    <th className="text-right px-4 py-3 font-medium text-[#1A56DB]">연간배당 (세후)</th>
                    <th className="text-right px-4 py-3 font-medium text-[#64748B]">월평균</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlistRows
                    .sort((a, b) => b.annualNet - a.annualNet)
                    .map((row, i) => {
                      const isSelected = !deselectedTickers.has(row.ticker)
                      const rowBg = !isSelected
                        ? 'bg-white'
                        : screenMap[row.ticker]?.buy_signal
                          ? 'bg-emerald-50'
                          : i % 2 ? 'bg-slate-50/50' : 'bg-white'
                      return (
                        <tr key={row.ticker}
                          className={`border-b border-[#E2E8F0] last:border-0 transition-opacity ${
                            !isSelected ? 'opacity-40' : ''
                          } ${rowBg}`}>
                          <td className={`px-3 py-3 text-center sticky left-0 z-10 ${rowBg}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setDeselectedTickers(prev => {
                                  const next = new Set(prev)
                                  if (isSelected) next.add(row.ticker)
                                  else next.delete(row.ticker)
                                  return next
                                })
                              }}
                              className="rounded accent-[#1A56DB] cursor-pointer"
                            />
                          </td>
                          <td className={`px-4 py-3 font-bold text-[#1A56DB] sticky left-8 z-10 border-r border-[#E2E8F0] ${rowBg}`}>
                            {row.ticker}
                            {row.isCustom && <span className="ml-1 text-[10px] bg-violet-100 text-violet-600 px-1 rounded">추가</span>}
                            {screenMap[row.ticker]?.buy_signal === 1 && <span className="ml-1 text-[10px]">⚡</span>}
                          </td>
                          <td className="px-4 py-3 text-[#0F172A]">{row.name}</td>
                          <td className="px-3 py-3 text-right tabular text-[#0F172A]">
                            {row.s?.price ? (
                              <div>
                                <p>{fmtUSD(row.s.price)}</p>
                                {usdkrw && <p className="text-[10px] text-[#64748B]">{fmtKRW(row.s.price * usdkrw)}</p>}
                              </div>
                            ) : <span className="text-slate-300">–</span>}
                          </td>
                          <td className="px-3 py-3 text-right tabular">
                            {row.s?.div_yield
                              ? <span className={row.s.div_yield >= (row.s.div_yield_5y ?? 0) ? 'text-emerald-600 font-medium' : ''}>
                                  {fmtPct(row.s.div_yield)}
                                </span>
                              : <span className="text-slate-300">–</span>}
                          </td>
                          <td className="px-3 py-3 text-right tabular font-medium">{row.shares}</td>
                          <td className="px-3 py-3 text-right tabular text-[#64748B]">
                            {row.annualGross > 0 ? (
                              <div>
                                <p>{fmtUSD(row.annualGross)}</p>
                                {usdkrw && <p className="text-[10px]">{fmtKRW(row.annualGross * usdkrw)}</p>}
                              </div>
                            ) : <span className="text-slate-300">–</span>}
                          </td>
                          <td className="px-3 py-3 text-right tabular text-red-500 text-xs">
                            {row.taxAmount > 0 ? `-${fmtUSD(row.taxAmount)}` : <span className="text-slate-300">–</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular font-bold text-[#1A56DB]">
                            {row.annualNet > 0 ? (
                              <div>
                                <p>{fmtUSD(row.annualNet)}</p>
                                {usdkrw && <p className="text-xs font-normal text-[#64748B]">{fmtKRW(row.annualNet * usdkrw)}</p>}
                              </div>
                            ) : <span className="text-slate-300 font-normal">–</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular text-[#64748B] text-xs">
                            {row.annualNet > 0 ? (
                              <div>
                                <p>{fmtUSD(row.annualNet / 12)}</p>
                                {usdkrw && <p className="text-[10px]">{fmtKRW((row.annualNet / 12) * usdkrw)}</p>}
                              </div>
                            ) : '–'}
                          </td>
                        </tr>
                      )
                    })}
                  {/* 선택 합계 행 */}
                  <tr className="bg-blue-50/60 border-t-2 border-[#1A56DB] font-semibold text-sm">
                    <td className="px-3 py-3" />
                    <td colSpan={5} className="px-4 py-3 text-[#0F172A]">
                      선택 합계
                      <span className="ml-1.5 text-xs font-normal text-[#64748B]">({selectedCount}종목)</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular text-[#64748B]">
                      <p>{fmtUSD(selectedTotals.gross)}</p>
                      {usdkrw && <p className="text-xs font-normal">{fmtKRW(selectedTotals.gross * usdkrw)}</p>}
                    </td>
                    <td className="px-3 py-3 text-right tabular text-red-500 text-xs">-{fmtUSD(selectedTotals.tax)}</td>
                    <td className="px-4 py-3 text-right tabular text-[#1A56DB]">
                      <p>{fmtUSD(selectedTotals.net)}</p>
                      {usdkrw && <p className="text-xs font-normal">{fmtKRW(selectedTotals.net * usdkrw)}</p>}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-[#64748B] text-xs">
                      <p>{fmtUSD(selectedTotals.net / 12)}</p>
                      {usdkrw && <p className="text-[10px]">{fmtKRW((selectedTotals.net / 12) * usdkrw)}</p>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── 포트폴리오 탭 ── */}
      {tab === 'portfolio' && (
        <>
          {portfolio.length === 0 ? (
            <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-8 text-center">
              <p className="text-sm text-[#64748B] mb-2">포트폴리오 데이터가 없습니다.</p>
              <p className="text-xs text-slate-400">포트폴리오 메뉴에서 NH API 동기화 후 다시 확인하세요.</p>
            </div>
          ) : (
            <>
              {/* 요약 */}
              <SummaryCards
                annual={ptTotals.net} monthly={ptTotals.net / 12}
                tax={ptTotals.tax} usdkrw={usdkrw}
                investment={portfolioRows.reduce((acc, r) => acc + (r.price ?? 0) * r.quantity, 0)}
              />

              {/* 금융소득종합과세 경고 */}
              <div className="mb-6">
                <KumyungTaxBanner annualGrossUsd={ptTotals.gross} usdkrw={usdkrw} />
              </div>

              {/* 결과 테이블 */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-x-auto">
                <div className="px-5 py-4 border-b border-[#E2E8F0]">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    보유 종목 배당 상세{' '}
                    <span className="text-xs font-normal text-[#64748B]">
                      ({portfolioRows.length}종목, 세율 {taxRate}%)
                    </span>
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs">
                      <th className="text-left px-4 py-3 font-medium text-[#64748B]">티커</th>
                      <th className="text-left px-4 py-3 font-medium text-[#64748B]">종목명</th>
                      <th className="text-right px-3 py-3 font-medium text-[#64748B]">보유 주수</th>
                      <th className="text-right px-3 py-3 font-medium text-[#64748B]">현재가</th>
                      <th className="text-right px-3 py-3 font-medium text-[#64748B]">배당률</th>
                      <th className="text-right px-3 py-3 font-medium text-[#64748B]">연간배당 (세전)</th>
                      <th className="text-right px-3 py-3 font-medium text-[#64748B]">세금</th>
                      <th className="text-right px-4 py-3 font-medium text-[#1A56DB]">연간배당 (세후)</th>
                      <th className="text-right px-4 py-3 font-medium text-[#64748B]">월평균</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioRows
                      .sort((a, b) => b.annualNet - a.annualNet)
                      .map((row, i) => (
                        <tr key={row.ticker}
                          className={`border-b border-[#E2E8F0] last:border-0 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                          <td className="px-4 py-3 font-bold text-[#1A56DB]">{row.ticker}</td>
                          <td className="px-4 py-3 text-[#0F172A]">{row.name}</td>
                          <td className="px-3 py-3 text-right tabular font-medium">{row.quantity}</td>
                          <td className="px-3 py-3 text-right tabular">
                            {row.price ? (
                              <div>
                                <p>{fmtUSD(row.price)}</p>
                                {usdkrw && <p className="text-[10px] text-[#64748B]">{fmtKRW(row.price * usdkrw)}</p>}
                              </div>
                            ) : <span className="text-slate-300">–</span>}
                          </td>
                          <td className="px-3 py-3 text-right tabular">
                            {row.divYield ? fmtPct(row.divYield) : <span className="text-slate-300">–</span>}
                          </td>
                          <td className="px-3 py-3 text-right tabular text-[#64748B]">
                            <div>
                              <p>{fmtUSD(row.annualGross)}</p>
                              {usdkrw && <p className="text-[10px]">{fmtKRW(row.annualGross * usdkrw)}</p>}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right tabular text-red-500 text-xs">-{fmtUSD(row.taxAmount)}</td>
                          <td className="px-4 py-3 text-right tabular font-bold text-[#1A56DB]">
                            <p>{fmtUSD(row.annualNet)}</p>
                            {usdkrw && <p className="text-xs font-normal text-[#64748B]">{fmtKRW(row.annualNet * usdkrw)}</p>}
                          </td>
                          <td className="px-4 py-3 text-right tabular text-[#64748B] text-xs">
                            <p>{fmtUSD(row.annualNet / 12)}</p>
                            {usdkrw && <p className="text-[10px]">{fmtKRW((row.annualNet / 12) * usdkrw)}</p>}
                          </td>
                        </tr>
                      ))}
                    <tr className="bg-blue-50/60 border-t-2 border-[#1A56DB] font-semibold text-sm">
                      <td colSpan={5} className="px-4 py-3 text-[#0F172A]">합계</td>
                      <td className="px-3 py-3 text-right tabular text-[#64748B]">
                        <p>{fmtUSD(ptTotals.gross)}</p>
                        {usdkrw && <p className="text-xs font-normal">{fmtKRW(ptTotals.gross * usdkrw)}</p>}
                      </td>
                      <td className="px-3 py-3 text-right tabular text-red-500 text-xs">-{fmtUSD(ptTotals.tax)}</td>
                      <td className="px-4 py-3 text-right tabular text-[#1A56DB]">
                        <p>{fmtUSD(ptTotals.net)}</p>
                        {usdkrw && <p className="text-xs font-normal">{fmtKRW(ptTotals.net * usdkrw)}</p>}
                      </td>
                      <td className="px-4 py-3 text-right tabular text-[#64748B] text-xs">
                        <p>{fmtUSD(ptTotals.net / 12)}</p>
                        {usdkrw && <p className="text-[10px]">{fmtKRW((ptTotals.net / 12) * usdkrw)}</p>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}



      {/* ── ETF 시뮬레이션 탭 ── */}
      {tab === 'etf' && (() => {
        const activeList = etfSubTab === 'us' ? usEtfList : krEtfList
        const isKr = etfSubTab === 'kr'

        // 현재 탭 ETF들의 배당 계산
        const etfRows = activeList.map(e => {
          const shares = etfShares[e.ticker] ?? 1
          const price = e.last_price ?? 0
          const yld = e.div_yield ?? 0
          const annualGross = price * (yld / 100) * shares
          const annualNet = annualGross * (1 - taxRate / 100)
          return { ...e, shares, price, yld, annualGross, annualNet, tax: annualGross - annualNet }
        })
        const totals = etfRows.reduce(
          (acc, r) => ({ gross: acc.gross + r.annualGross, net: acc.net + r.annualNet, tax: acc.tax + r.tax }),
          { gross: 0, net: 0, tax: 0 }
        )

        return (
          <>
            {/* 서브탭 */}
            <div className="flex gap-2 mb-5">
              {([
                { id: 'us', label: '🇺🇸 미국 ETF', count: usEtfList.length },
                { id: 'kr', label: '🇰🇷 국내 ETF', count: krEtfList.length },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setEtfSubTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    etfSubTab === t.id
                      ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'
                  }`}>
                  {t.label} <span className="ml-1 text-xs opacity-60">({t.count})</span>
                </button>
              ))}
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: '연간 배당 (세전)', val: totals.gross, isKrw: isKr },
                { label: '세금 차감', val: -totals.tax, isKrw: isKr, neg: true },
                { label: '연간 배당 (세후)', val: totals.net, isKrw: isKr, accent: true },
                { label: '월평균 (세후)', val: totals.net / 12, isKrw: isKr },
              ].map(card => (
                <div key={card.label} className={`rounded-xl border p-4 ${card.accent ? 'border-[#1A56DB] bg-blue-50' : 'border-[#E2E8F0] bg-white'}`}>
                  <p className="text-xs text-[#64748B] mb-1">{card.label}</p>
                  <p className={`text-xl font-bold tabular ${card.accent ? 'text-[#1A56DB]' : card.neg ? 'text-red-600' : 'text-[#0F172A]'}`}>
                    {card.neg ? '-' : ''}{card.isKrw
                      ? `₩${Math.round(Math.abs(card.val)).toLocaleString()}`
                      : fmtUSD(Math.abs(card.val))
                    }
                  </p>
                  {!card.isKrw && usdkrw && (
                    <p className="text-xs text-[#64748B] mt-0.5">{fmtKRW(Math.abs(card.val) * usdkrw)}</p>
                  )}
                  {card.isKrw && usdkrw && Math.abs(card.val) > 0 && (
                    <p className="text-xs text-[#64748B] mt-0.5">{fmtUSD(Math.abs(card.val) / usdkrw)}</p>
                  )}
                </div>
              ))}
            </div>

            {/* ETF 테이블 */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-auto">
              <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0F172A]">
                  {isKr ? '국내 상장' : '미국'} ETF{' '}
                  <span className="text-xs font-normal text-[#64748B]">({activeList.length}종목)</span>
                </p>
                <p className="text-xs text-[#64748B]">
                  {isKr ? '주가·배당 단위: 원(KRW)' : '주가·배당 단위: 달러(USD)'}
                  {' '}· 세율 {taxRate}%
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs">
                    <th className="text-left px-4 py-3 font-medium text-[#64748B]">티커{isKr ? '/종목코드' : ''}</th>
                    <th className="text-left px-3 py-3 font-medium text-[#64748B] min-w-[160px]">종목명</th>
                    {isKr && <th className="text-left px-3 py-3 font-medium text-[#64748B]">운용사</th>}
                    {isKr && <th className="text-left px-3 py-3 font-medium text-[#64748B]">미국원본</th>}
                    {!isKr && <th className="text-left px-3 py-3 font-medium text-[#64748B]">카테고리</th>}
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">현재가</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">배당률</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">보유 주수</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">연간배당 (세전)</th>
                    <th className="text-right px-3 py-3 font-medium text-[#64748B]">세금</th>
                    <th className="text-right px-4 py-3 font-medium text-[#1A56DB]">연간배당 (세후)</th>
                  </tr>
                </thead>
                <tbody>
                  {etfRows.map((row, i) => (
                    <tr key={row.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${i % 2 ? 'bg-slate-50/40' : 'bg-white'}`}>
                      <td className="px-4 py-3 font-bold text-[#1A56DB] text-xs whitespace-nowrap">{row.ticker}</td>
                      <td className="px-3 py-3 text-xs text-[#0F172A] max-w-[160px]">
                        <span className="block truncate" title={row.name}>{row.name}</span>
                      </td>
                      {isKr && <td className="px-3 py-3 text-xs text-[#64748B] whitespace-nowrap">{row.issuer ?? '–'}</td>}
                      {isKr && <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{row.us_equiv ?? '–'}</td>}
                      {!isKr && <td className="px-3 py-3 text-xs text-[#64748B]">{row.category ?? '–'}</td>}
                      <td className="px-3 py-3 text-right tabular text-xs text-[#0F172A] whitespace-nowrap">
                        {isKr
                          ? `₩${Math.round(row.price).toLocaleString()}`
                          : fmtUSD(row.price)}
                      </td>
                      <td className="px-3 py-3 text-right tabular text-xs text-emerald-600 font-medium">{fmtPct(row.yld)}</td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number" min="0" value={row.shares}
                          onChange={e => setEtfShares(prev => ({ ...prev, [row.ticker]: Math.max(0, Number(e.target.value)) }))}
                          className="w-20 border border-[#E2E8F0] rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-[#1A56DB]"
                        />
                      </td>
                      <td className="px-3 py-3 text-right tabular text-xs text-[#64748B]">
                        {row.annualGross > 0 ? (
                          <div>
                            <p>{isKr ? `₩${Math.round(row.annualGross).toLocaleString()}` : fmtUSD(row.annualGross)}</p>
                            {isKr && usdkrw ? <p className="text-[10px]">{fmtUSD(row.annualGross / usdkrw)}</p>
                              : !isKr && usdkrw ? <p className="text-[10px]">{fmtKRW(row.annualGross * usdkrw)}</p> : null}
                          </div>
                        ) : <span className="text-slate-300">–</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular text-xs text-red-500">
                        {row.tax > 0 ? (isKr ? `-₩${Math.round(row.tax).toLocaleString()}` : `-${fmtUSD(row.tax)}`) : <span className="text-slate-300">–</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular font-bold text-[#1A56DB]">
                        {row.annualNet > 0 ? (
                          <div>
                            <p className="text-xs">{isKr ? `₩${Math.round(row.annualNet).toLocaleString()}` : fmtUSD(row.annualNet)}</p>
                            {isKr && usdkrw ? <p className="text-[10px] font-normal text-[#64748B]">{fmtUSD(row.annualNet / usdkrw)}</p>
                              : !isKr && usdkrw ? <p className="text-[10px] font-normal text-[#64748B]">{fmtKRW(row.annualNet * usdkrw)}</p> : null}
                          </div>
                        ) : <span className="text-slate-300 font-normal text-xs">–</span>}
                      </td>
                    </tr>
                  ))}
                  {/* 합계 행 */}
                  <tr className="bg-blue-50/60 border-t-2 border-[#1A56DB] font-semibold text-sm">
                    <td colSpan={isKr ? 7 : 6} className="px-4 py-3 text-[#0F172A]">
                      합계
                      <span className="ml-1.5 text-xs font-normal text-[#64748B]">({etfRows.filter(r => r.shares > 0).length}종목)</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular text-[#64748B] text-xs">
                      {isKr ? `₩${Math.round(totals.gross).toLocaleString()}` : fmtUSD(totals.gross)}
                    </td>
                    <td className="px-3 py-3 text-right tabular text-red-500 text-xs">
                      -{isKr ? `₩${Math.round(totals.tax).toLocaleString()}` : fmtUSD(totals.tax)}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-[#1A56DB]">
                      <p className="text-xs">{isKr ? `₩${Math.round(totals.net).toLocaleString()}` : fmtUSD(totals.net)}</p>
                      {isKr && usdkrw && <p className="text-[10px] font-normal text-[#64748B]">{fmtUSD(totals.net / usdkrw)}</p>}
                      {!isKr && usdkrw && <p className="text-[10px] font-normal text-[#64748B]">{fmtKRW(totals.net * usdkrw)}</p>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
              {isKr
                ? '* 국내 ETF 주가는 추정치(최근 수집 기준)입니다. 배당률은 최근 12개월 실적 기준 추정치이며 실제와 다를 수 있습니다. 국내 ETF 배당소득세는 15.4% 원천징수가 일반적입니다.'
                : '* 미국 ETF 주가는 최근 수집 기준이며 실시간 시세가 아닙니다. 배당률은 yfinance 제공 최신 배당수익률 기준입니다.'}
            </p>
          </>
        )
      })()}

      {/* 하단 면책 문구 */}
      <p className="text-[10px] text-slate-400 mt-6 leading-relaxed">
        * 배당금 = 현재 주가 × 최신 배당률 × 보유 주수 (세전) 기준 추정치입니다. 실제 배당금은 분기별 선언 기준이며 변동될 수 있습니다.<br />
        * 세율은 미국 주식 배당소득 기준이며, 개인 소득 합산·계좌 유형·조세협약 해석에 따라 실효세율이 달라질 수 있습니다.<br />
        * 공식 세율 확인:{' '}
        <a href="https://www.nts.go.kr" target="_blank" rel="noopener" className="text-[#1A56DB] hover:underline">국세청</a>
        {' · '}
        <a href="https://www.moef.go.kr" target="_blank" rel="noopener" className="text-[#1A56DB] hover:underline">기획재정부</a>
        {' · '}
        <a href="https://www.fsc.go.kr" target="_blank" rel="noopener" className="text-[#1A56DB] hover:underline">금융위원회</a>
      </p>
    </div>
  )
}

export default function SimulationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[#64748B]">불러오는 중...</div>}>
      <SimulationContent />
    </Suspense>
  )
}
