'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import VerdictBadge from '@/app/components/VerdictBadge'
import { WATCHLIST, SUPER_INVESTORS, SUPER_INVESTOR_COMMON } from '@/lib/watchlist'

interface Stock {
  ticker: string
  div_yield: number | null
  div_yield_5y: number | null
  price: number | null
  payout_ratio: number | null
  div_growth_5y: number | null
  peg: number | null
}
interface Screening {
  ticker: string
  buy_signal: number
  overall_pass: number
  signal_reason: string | null
  pass_payout: number
  pass_div_growth: number
  pass_peg: number
  pass_de: number
  pass_roe: number
  pass_eps: number
}
interface MacroSignal {
  id: string; label: string; status: 'ok' | 'warning' | 'danger'; value: string; detail: string
}
interface MacroSummary {
  risk_score: number; risk_level: 'low' | 'moderate' | 'high'
  signals: MacroSignal[]; recommendation: string; updated_at: string | null
}
interface MarketData { USDKRW?: { price: number } | null }

interface InvestorData {
  holdings: Record<string, string[]>
  common: string[]
  updated_at: string | null
  memo: string
  from_db: boolean
}
interface InvestorHistory {
  id: number; updated_at: string; memo: string
  holdings: Record<string, string[]>
  common: string[]
}

const WL_MAP = Object.fromEntries(WATCHLIST.map(w => [w.ticker, w]))

const RISK_CONFIG = {
  low:      { label: '양호', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  moderate: { label: '주의', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  high:     { label: '위험', bg: 'bg-red-50',      border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500'     },
}
const SIGNAL_DOT: Record<string, string> = { ok: 'bg-emerald-400', warning: 'bg-amber-400', danger: 'bg-red-500' }
const SENSITIVITY_CONFIG = {
  defensive: { label: '방어주', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  moderate:  { label: '중립',   bg: 'bg-slate-100',  text: 'text-slate-600'   },
  sensitive: { label: '민감',   bg: 'bg-red-50',     text: 'text-red-600'     },
}

function PassBadge({ val }: { val: number | null | undefined }) {
  if (val === null || val === undefined) return <span className="text-slate-300 text-xs">–</span>
  return val === 1
    ? <span className="text-emerald-600 text-xs font-bold">✅</span>
    : <span className="text-red-500 text-xs font-bold">❌</span>
}

function MacroBanner({ macro }: { macro: MacroSummary | null }) {
  if (!macro) return null
  const cfg = RISK_CONFIG[macro.risk_level]
  return (
    <div className={`rounded-xl border p-4 mb-6 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0 mt-0.5`} />
          <div>
            <span className={`text-sm font-semibold ${cfg.text}`}>거시경제 위험도 — {cfg.label}</span>
            <span className={`ml-2 text-xs ${cfg.text} opacity-70`}>신호 {macro.risk_score}/3</span>
          </div>
        </div>
        {macro.updated_at && <span className="text-[10px] text-slate-400">{macro.updated_at.slice(0, 10)} 기준</span>}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {macro.signals.map(sig => (
          <div key={sig.id} className="bg-white/60 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${SIGNAL_DOT[sig.status]} shrink-0`} />
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{sig.label}</span>
            </div>
            <p className="text-base font-bold text-slate-800 tabular">{sig.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{sig.detail}</p>
          </div>
        ))}
      </div>
      <p className={`text-xs font-medium ${cfg.text}`}>💡 {macro.recommendation}</p>
    </div>
  )
}

function InvestorTable({ tickers, stockMap, screenMap, nameMap, macro, usdkrw }: {
  tickers: string[]
  stockMap: Record<string, Stock>
  screenMap: Record<string, Screening>
  nameMap: Record<string, string>
  macro: MacroSummary | null
  usdkrw: number | null
}) {
  return (
    <div className="overflow-auto max-h-[600px]">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#E2E8F0] bg-slate-50 sticky top-0 z-20">
            <th className="text-left px-3 py-2 font-medium text-[#64748B] sticky left-0 z-30 bg-slate-50 border-r border-[#E2E8F0]">티커</th>
            <th className="text-left px-3 py-2 font-medium text-[#64748B] sticky left-[64px] z-30 bg-slate-50 border-r border-[#E2E8F0] min-w-[120px]">종목명</th>
            <th className="text-right px-3 py-2 font-medium text-[#64748B]">현재가</th>
            <th className="text-right px-3 py-2 font-medium text-[#64748B]">배당률</th>
            <th className="text-right px-3 py-2 font-medium text-[#64748B]">5년평균</th>
            <th className="text-center px-3 py-2 font-medium text-[#64748B]">배당성향</th>
            <th className="text-center px-3 py-2 font-medium text-[#64748B]">배당성장</th>
            <th className="text-center px-3 py-2 font-medium text-[#64748B]">PEG</th>
            <th className="text-center px-3 py-2 font-medium text-[#64748B]">기준통과</th>
            <th className="text-center px-3 py-2 font-medium text-[#64748B]">매수신호</th>
            <th className="text-center px-3 py-2 font-medium text-[#64748B] min-w-[100px]">🎯 결과</th>
            {macro && macro.risk_level !== 'low' && (
              <th className="text-center px-3 py-2 font-medium text-[#64748B]">거시민감도</th>
            )}
          </tr>
        </thead>
        <tbody>
          {tickers.map((t, i) => {
            const s = stockMap[t]
            const sc = screenMap[t]
            const wl = WL_MAP[t]
            const inWatchlist = !!wl
            const sensitivity = wl?.macro_sensitivity as keyof typeof SENSITIVITY_CONFIG | undefined
            const sensCfg = sensitivity ? SENSITIVITY_CONFIG[sensitivity] : null
            const rowHighlight = macro && macro.risk_level === 'high' && sensitivity === 'sensitive' ? 'bg-red-50/40' : ''
            const rowBg = rowHighlight || (i % 2 ? 'bg-slate-50/50' : 'bg-white')
            return (
              <tr key={t} className={`border-b border-[#E2E8F0] last:border-0 ${rowBg}`}>
                <td className={`px-3 py-2 sticky left-0 z-10 border-r border-[#E2E8F0] ${rowBg}`}>
                  <span className={`font-bold ${inWatchlist ? 'text-[#1A56DB]' : 'text-slate-500'}`}>{t}</span>
                  {!inWatchlist && <span className="ml-1 text-[9px] text-slate-400 bg-slate-100 px-1 rounded">미추적</span>}
                </td>
                <td className={`px-3 py-2 text-[#0F172A] sticky left-[64px] z-10 border-r border-[#E2E8F0] min-w-[120px] ${rowBg}`}>{wl?.name ?? nameMap[t] ?? '–'}</td>
                <td className="px-3 py-2 text-right tabular">
                  {s?.price ? (
                    <div>
                      <p>${s.price.toFixed(2)}</p>
                      {usdkrw && <p className="text-[10px] text-[#64748B]">₩{Math.round(s.price * usdkrw).toLocaleString()}</p>}
                    </div>
                  ) : '–'}
                </td>
                <td className="px-3 py-2 text-right tabular font-medium">
                  {s?.div_yield ? (
                    <span className={s.div_yield >= (s.div_yield_5y ?? 0) ? 'text-emerald-600' : ''}>
                      {s.div_yield.toFixed(2)}%
                    </span>
                  ) : '–'}
                </td>
                <td className="px-3 py-2 text-right tabular text-[#64748B]">{s?.div_yield_5y ? `${s.div_yield_5y.toFixed(2)}%` : '–'}</td>
                <td className="px-3 py-2 text-center"><PassBadge val={sc?.pass_payout} /></td>
                <td className="px-3 py-2 text-center"><PassBadge val={sc?.pass_div_growth} /></td>
                <td className="px-3 py-2 text-center"><PassBadge val={sc?.pass_peg} /></td>
                <td className="px-3 py-2 text-center">
                  <PassBadge val={sc?.overall_pass} />
                </td>
                <td className="px-3 py-2 text-center">
                  {sc?.buy_signal ? '⚡' : <span className="text-slate-200">·</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  <VerdictBadge overallPass={sc?.overall_pass} buySignal={sc?.buy_signal} signalReason={sc?.signal_reason} size="sm" />
                </td>
                {macro && macro.risk_level !== 'low' && (
                  <td className="px-3 py-2 text-center">
                    {sensCfg ? (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sensCfg.bg} ${sensCfg.text}`}>
                        {sensCfg.label}
                      </span>
                    ) : <span className="text-slate-300">–</span>}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 이전 버전과 현재 버전 티커 diff
function TickerDiff({ prev, curr }: { prev: string[]; curr: string[] }) {
  const added = curr.filter(t => !prev.includes(t))
  const removed = prev.filter(t => !curr.includes(t))
  if (added.length === 0 && removed.length === 0) return <span className="text-xs text-slate-400">변경 없음</span>
  return (
    <span className="text-xs flex flex-wrap gap-1">
      {added.map(t => <span key={t} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">+{t}</span>)}
      {removed.map(t => <span key={t} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">-{t}</span>)}
    </span>
  )
}

export default function SignalsPage() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [screening, setScreening] = useState<Screening[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [candidateTickerSet, setCandidateTickerSet] = useState<Set<string>>(new Set())
  const [customWatchlist, setCustomWatchlist] = useState<{ ticker: string; name: string }[]>([])
  const [macro, setMacro] = useState<MacroSummary | null>(null)
  const [usdkrw, setUsdkrw] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // 투자대가 데이터
  const [investorData, setInvestorData] = useState<InvestorData | null>(null)
  const [investorHistory, setInvestorHistory] = useState<InvestorHistory[]>([])

  // 미추적 종목 추가
  const [addingTicker, setAddingTicker] = useState<string | null>(null)
  const [addMsg, setAddMsg] = useState('')

  // 편집 상태
  const [showEdit, setShowEdit] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editHoldings, setEditHoldings] = useState<Record<string, string>>({})
  const [editMemo, setEditMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/stocks').then(r => r.json()),
      fetch('/api/macro/summary').then(r => r.json()),
      fetch('/api/market').then(r => r.json()).catch(() => null),
      fetch('/api/investors').then(r => r.json()),
      fetch('/api/investors/history').then(r => r.json()).catch(() => []),
      fetch('/api/candidates').then(r => r.json()).catch(() => []),
    ]).then(([stocksData, macroData, marketData, invData, invHistory, candidatesData]) => {
      // 단일 소스: /api/stocks가 universe_screening을 pass_* 형태로 반환
      const watchlistScreening: Screening[] = stocksData.screening || []
      const screeningTickers = new Set(watchlistScreening.map((s: Screening) => s.ticker))

      // candidates 보충 (universe_screening에 없는 후보 종목)
      const candidatesScreening = (Array.isArray(candidatesData) ? candidatesData : [])
        .filter((c: { ticker: string; overall_pass?: number | null }) =>
          !screeningTickers.has(c.ticker) && c.overall_pass !== null && c.overall_pass !== undefined)
        .map((c: { ticker: string; overall_pass: number; buy_signal: number; signal_reason: string | null;
                   pass_payout: number | null; pass_div_growth: number | null; pass_peg: number | null;
                   pass_de: number | null; pass_roe: number | null; pass_eps: number | null }) => ({
          ticker: c.ticker, overall_pass: c.overall_pass, buy_signal: c.buy_signal,
          signal_reason: c.signal_reason,
          pass_payout: c.pass_payout, pass_div_growth: c.pass_div_growth, pass_peg: c.pass_peg,
          pass_de: c.pass_de, pass_roe: c.pass_roe, pass_eps: c.pass_eps,
        }))
      setStocks(stocksData.stocks || [])
      setScreening([...watchlistScreening, ...candidatesScreening] as Screening[])
      setCustomWatchlist(stocksData.customWatchlist || [])

      // nameMap: screening(universe 이름) + candidates + WATCHLIST + customWatchlist 통합
      const nm: Record<string, string> = {}
      for (const u of (stocksData.screening || []) as Array<{ ticker: string; name?: string }>) {
        if (u.ticker && u.name) nm[u.ticker] = u.name
      }
      for (const c of (Array.isArray(candidatesData) ? candidatesData : []) as Array<{ ticker: string; name: string }>) {
        if (c.name) nm[c.ticker] = c.name
      }
      for (const w of WATCHLIST) nm[w.ticker] = w.name
      for (const c of (stocksData.customWatchlist || [])) {
        if (c.name) nm[c.ticker] = c.name
      }
      setNameMap(nm)
      setCandidateTickerSet(new Set(
        (Array.isArray(candidatesData) ? candidatesData : [])
          .filter((c: { status?: string }) => c.status === 'watching')
          .map((c: { ticker: string }) => c.ticker)
      ))
      if (!macroData.error) setMacro(macroData)
      const md = marketData as MarketData | null
      if (md?.USDKRW?.price) setUsdkrw(md.USDKRW.price)
      setInvestorData(invData)
      setInvestorHistory(Array.isArray(invHistory) ? invHistory : [])
    }).finally(() => setLoading(false))
  }, [])

  // 편집 패널 열 때 현재 데이터로 초기화
  function openEdit() {
    const src = investorData?.holdings ?? SUPER_INVESTORS
    const init: Record<string, string> = {}
    for (const [name, tickers] of Object.entries(src)) {
      init[name] = tickers.join(', ')
    }
    setEditHoldings(init)
    setEditMemo('')
    setSaveMsg('')
    setShowEdit(true)
    setShowHistory(false)
  }

  async function saveInvestors() {
    setSaving(true)
    setSaveMsg('')
    const parsed: Record<string, string[]> = {}
    for (const [name, raw] of Object.entries(editHoldings)) {
      parsed[name] = raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
    }
    const r = await fetch('/api/investors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdings: parsed, memo: editMemo }),
    })
    const d = await r.json()
    if (d.ok) {
      const [inv, hist] = await Promise.all([
        fetch('/api/investors').then(r => r.json()),
        fetch('/api/investors/history').then(r => r.json()).catch(() => []),
      ])
      setInvestorData(inv)
      setInvestorHistory(Array.isArray(hist) ? hist : [])
      setSaveMsg('저장 완료')
      setShowEdit(false)
    } else {
      setSaveMsg(`실패: ${d.error}`)
    }
    setSaving(false)
  }

  function restoreHistory(entry: InvestorHistory) {
    setInvestorData({
      holdings: entry.holdings,
      common: entry.common,
      updated_at: entry.updated_at,
      memo: entry.memo,
      from_db: true,
    })
    setShowHistory(false)
  }

  const stockMap = Object.fromEntries(stocks.map(s => [s.ticker, s]))
  const screenMap = Object.fromEntries(screening.map(s => [s.ticker, s]))

  // 매수 신호 카드 = 사용자가 관심 두는 종목 중 🎯 매수 후보 (기준 ✅ AND 가격 ⚡)
  // 관심 범위: WATCHLIST + customWatchlist + 후보함 + 투자대가 보유 종목
  const investorTickers = new Set<string>()
  Object.values((investorData?.holdings ?? SUPER_INVESTORS) as Record<string, string[]>)
    .forEach(arr => arr.forEach(t => investorTickers.add(t)))
  const interestedTickers = new Set<string>([
    ...WATCHLIST.map(w => w.ticker),
    ...customWatchlist.map(c => c.ticker),
    ...investorTickers,
    ...candidateTickerSet,
  ])
  const buySignals = screening.filter(s =>
    s.overall_pass === 1 && s.buy_signal === 1 && interestedTickers.has(s.ticker)
  )
  // 참고용: 함정 주의(가격은 매력적이나 품질 미달) 카운트
  const trapCount = screening.filter(s =>
    s.overall_pass === 0 && s.buy_signal === 1 && interestedTickers.has(s.ticker)
  ).length

  const holdings = investorData?.holdings ?? SUPER_INVESTORS
  const common = investorData?.common ?? SUPER_INVESTOR_COMMON

  // 미추적 종목 계산 (WATCHLIST + customWatchlist에 없는 투자대가 보유 종목)
  const watchedTickers = new Set([
    ...WATCHLIST.map(w => w.ticker),
    ...customWatchlist.map(c => c.ticker),
  ])
  const untrackedByTicker: Record<string, string[]> = {}
  for (const [name, tickers] of Object.entries(holdings)) {
    for (const t of tickers) {
      if (!watchedTickers.has(t)) {
        if (!untrackedByTicker[t]) untrackedByTicker[t] = []
        untrackedByTicker[t].push(name.split(' ')[0])  // 성씨만
      }
    }
  }
  const untrackedTickers = Object.keys(untrackedByTicker).sort()

  async function addToWatchlist(ticker: string) {
    setAddingTicker(ticker)
    setAddMsg('')
    try {
      const r = await fetch('/api/watchlist/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ ticker, name: ticker, sector: '', tier: '', years: 0 }] }),
      })
      const d = await r.json()
      if (d.ok) {
        setCustomWatchlist(prev => [...prev, { ticker, name: ticker }])
        setAddMsg(`${ticker} 추가 완료`)
      } else {
        setAddMsg(`실패: ${d.error}`)
      }
    } catch (e) {
      setAddMsg(String(e))
    }
    setAddingTicker(null)
  }

  // 차트: WATCHLIST + 후보함 + customWatchlist 통합 (배당 있는 종목만)
  const chartTickers = Array.from(new Set([
    ...WATCHLIST.map(w => w.ticker),
    ...candidateTickerSet,
    ...customWatchlist.map(c => c.ticker),
  ]))
  const chartData = chartTickers
    .map(t => {
      const s = stockMap[t]
      return { ticker: t, 현재배당률: s?.div_yield || 0, '5년평균': s?.div_yield_5y || 0 }
    })
    .filter(d => d.현재배당률 > 0 || d['5년평균'] > 0)

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🎯 매수 신호</h1>
        <p className="text-sm text-[#64748B] mt-1">
          관심 범위 내 <b className="text-emerald-700">🎯 매수 후보 {buySignals.length}건</b>
          {trapCount > 0 && (
            <span className="text-amber-600 ml-2">
              · ⚠️ 함정 주의 {trapCount}건 (가격은 매력적이나 품질 미달, 투자대가 보유 페이지에서 확인)
            </span>
          )}
        </p>
        <p className="text-[10px] text-[#94A3B8] mt-0.5">
          관심 범위: 감시 종목 + 후보함 + 투자대가 보유 (S&P 500 전체에서 보려면 [신규 발굴] 페이지)
        </p>
      </div>

      <MacroBanner macro={macro} />

      {/* 매수 신호 카드 */}
      {buySignals.length > 0 ? (
        <div className="flex flex-col gap-2 mb-6">
          {buySignals.map(sc => {
            const wl = WL_MAP[sc.ticker]
            const s = stockMap[sc.ticker]
            const sensitivity = wl?.macro_sensitivity as keyof typeof SENSITIVITY_CONFIG | undefined
            const sensCfg = sensitivity ? SENSITIVITY_CONFIG[sensitivity] : null
            return (
              <div key={sc.ticker} className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 w-52 shrink-0">
                  <span className="text-base font-bold text-emerald-700">{sc.ticker}</span>
                  <span className="text-sm font-semibold text-[#0F172A]">{wl?.name ?? nameMap[sc.ticker] ?? sc.ticker}</span>
                </div>
                <span className="flex-1 text-sm text-slate-500">
                  {s?.price && (
                    <>${s.price.toFixed(2)}
                    {usdkrw && <span> (₩{Math.round(s.price * usdkrw).toLocaleString()})</span>}
                    {' '}·{' '}
                    </>
                  )}
                  배당률 {s?.div_yield?.toFixed(2) ?? '–'}% / 5년평균 {s?.div_yield_5y?.toFixed(2) ?? '–'}%
                </span>
                {sensCfg && macro && macro.risk_level !== 'low' && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sensCfg.bg} ${sensCfg.text}`}>
                    거시 {sensCfg.label}
                  </span>
                )}
                <span className="text-sm font-medium text-emerald-700">{sc.signal_reason}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mb-6 p-5 bg-slate-50 border border-[#E2E8F0] rounded-xl text-sm text-[#64748B]">
          현재 매수 신호 발생 종목이 없습니다.
        </div>
      )}

      {/* 배당률 vs 5년 평균 차트 */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-6">
        <p className="text-sm font-semibold mb-4">배당률 vs 5년 평균 (관심 종목)</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ left: -10 }}>
            <XAxis dataKey="ticker" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(2)}%` : v} />
            <Legend />
            <Bar dataKey="현재배당률" fill="#1A56DB" radius={[3, 3, 0, 0]} />
            <Bar dataKey="5년평균" fill="#94A3B8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 투자대가 미추적 종목 ── */}
      {untrackedTickers.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-[#E2E8F0] bg-amber-50/60 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                투자대가 미추적 종목
                <span className="ml-2 text-xs font-normal text-[#64748B]">{untrackedTickers.length}종목 — 감시 목록에 없음</span>
              </p>
              <p className="text-xs text-[#64748B] mt-0.5">추가 후 데이터 갱신 시 스크리닝 결과가 반영됩니다</p>
            </div>
            {addMsg && <p className="text-xs text-emerald-600 font-medium">{addMsg}</p>}
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#E2E8F0] bg-slate-50">
                  <th className="text-left px-4 py-2 font-medium text-[#64748B]">티커</th>
                  <th className="text-left px-4 py-2 font-medium text-[#64748B]">보유 대가</th>
                  <th className="text-right px-4 py-2 font-medium text-[#64748B]">현재가</th>
                  <th className="text-right px-4 py-2 font-medium text-[#64748B]">배당률</th>
                  <th className="text-center px-4 py-2 font-medium text-[#64748B]">감시 추가</th>
                </tr>
              </thead>
              <tbody>
                {untrackedTickers.map((t, i) => {
                  const s = stockMap[t]
                  const investors = untrackedByTicker[t]
                  return (
                    <tr key={t} className={`border-b border-[#E2E8F0] last:border-0 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                      <td className="px-4 py-2.5 font-bold text-slate-600">{t}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {investors.map(inv => (
                            <span key={inv} className="text-[10px] bg-blue-50 text-[#1A56DB] px-1.5 py-0.5 rounded font-medium">{inv}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">
                        {s?.price ? (
                          <div>
                            <p>${s.price.toFixed(2)}</p>
                            {usdkrw && <p className="text-[10px] text-[#64748B]">₩{Math.round(s.price * usdkrw).toLocaleString()}</p>}
                          </div>
                        ) : <span className="text-slate-300">–</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">
                        {s?.div_yield ? `${s.div_yield.toFixed(2)}%` : <span className="text-slate-300">–</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => addToWatchlist(t)}
                          disabled={addingTicker === t}
                          className="text-[10px] px-2.5 py-1 bg-[#1A56DB] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                        >
                          {addingTicker === t ? '추가 중...' : '+ 감시 추가'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 투자대가 섹션 헤더 ── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">투자대가 포트폴리오</p>
          <p className="text-xs text-[#64748B]">
            {investorData?.from_db
              ? `${investorData.updated_at?.slice(0, 10)} 업데이트${investorData.memo ? ` · ${investorData.memo}` : ''}`
              : 'DataRoma 기준 (기본값) — 편집으로 최신 데이터 반영'
            }
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowHistory(h => !h); setShowEdit(false) }}
            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${showHistory ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'}`}
          >
            🕘 변경 이력 {investorHistory.length > 0 && <span className="ml-1 bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{investorHistory.length}</span>}
          </button>
          <button
            onClick={openEdit}
            className="px-3 py-1.5 text-xs bg-[#1A56DB] text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ✏️ 포트폴리오 편집
          </button>
        </div>
      </div>

      {/* 편집 패널 */}
      {showEdit && (
        <div className="mb-4 bg-white rounded-xl border border-[#1A56DB] p-5">
          <p className="text-sm font-semibold text-[#0F172A] mb-1">포트폴리오 편집</p>
          <p className="text-xs text-[#64748B] mb-4">
            DataRoma에서 최신 포트폴리오 확인 후 티커를 쉼표로 구분해 입력하세요. 공통 보유는 2인 이상 겹치는 종목으로 자동 계산됩니다.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {Object.entries(editHoldings).map(([name, raw]) => (
              <div key={name}>
                <label className="text-xs font-medium text-[#0F172A] mb-1 block">{name}</label>
                <textarea
                  value={raw}
                  onChange={e => setEditHoldings(prev => ({ ...prev, [name]: e.target.value }))}
                  rows={3}
                  className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1A56DB] resize-none font-mono"
                  placeholder="AAPL, MSFT, GOOGL ..."
                />
                <p className="text-[10px] text-[#64748B] mt-0.5">
                  {raw.split(',').map(t => t.trim()).filter(Boolean).length}종목
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editMemo}
              onChange={e => setEditMemo(e.target.value)}
              placeholder="메모 (예: 2026Q1 DataRoma 기준)"
              className="flex-1 text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1A56DB]"
            />
            <button
              onClick={() => setShowEdit(false)}
              className="px-3 py-2 text-xs border border-[#E2E8F0] text-[#64748B] rounded-lg hover:bg-slate-50"
            >
              취소
            </button>
            <button
              onClick={saveInvestors}
              disabled={saving}
              className="px-4 py-2 text-xs bg-[#1A56DB] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
          {saveMsg && <p className={`text-xs mt-2 ${saveMsg.includes('완료') ? 'text-emerald-600' : 'text-red-600'}`}>{saveMsg}</p>}
        </div>
      )}

      {/* 변경 이력 패널 */}
      {showHistory && (
        <div className="mb-4 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0F172A]">🕘 포트폴리오 변경 이력</p>
            <p className="text-xs text-[#64748B]">행 클릭 시 해당 시점으로 복원</p>
          </div>
          {investorHistory.length === 0 ? (
            <p className="text-sm text-[#64748B] px-5 py-4">저장 이력이 없습니다.</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0] max-h-96 overflow-y-auto">
              {investorHistory.map((h, i) => {
                const prev = investorHistory[i + 1]
                return (
                  <button
                    key={h.id}
                    onClick={() => restoreHistory(h)}
                    className="w-full text-left px-5 py-4 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {i === 0 && <span className="text-[10px] bg-[#1A56DB] text-white px-2 py-0.5 rounded-full">최신</span>}
                          <p className="text-sm font-medium text-[#0F172A]">
                            {new Date(h.updated_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            {h.memo && <span className="ml-2 text-[#64748B] font-normal">— {h.memo}</span>}
                          </p>
                        </div>
                        {/* 직전 버전과 diff */}
                        {prev && (
                          <div className="space-y-1">
                            {Object.entries(h.holdings).map(([name, tickers]) => {
                              const prevTickers = prev.holdings[name] || []
                              const added = tickers.filter(t => !prevTickers.includes(t))
                              const removed = prevTickers.filter(t => !tickers.includes(t))
                              if (added.length === 0 && removed.length === 0) return null
                              return (
                                <div key={name} className="flex items-start gap-2">
                                  <span className="text-[10px] text-[#64748B] shrink-0 mt-0.5 w-32 truncate">{name.split(' ')[0]}</span>
                                  <TickerDiff prev={prevTickers} curr={tickers} />
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {!prev && (
                          <div className="flex flex-wrap gap-1">
                            {Object.values(h.holdings).flat().slice(0, 10).map(t => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{t}</span>
                            ))}
                            <span className="text-[10px] text-slate-400">외 {Object.values(h.holdings).flat().length - 10}종목</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-[#1A56DB] shrink-0">복원 →</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 투자대가 4인 공통 보유 */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-[#E2E8F0]">
          <p className="text-sm font-semibold text-[#0F172A]">
            투자대가 공통 보유 종목
            <span className="ml-2 text-xs font-normal text-[#64748B]">2인 이상 공통 보유 · {common.length}종목</span>
          </p>
        </div>
        <InvestorTable tickers={common} stockMap={stockMap} screenMap={screenMap} nameMap={nameMap} macro={macro} usdkrw={usdkrw} />
      </div>

      {/* 투자대가별 포트폴리오 */}
      <div className="flex flex-col gap-3">
        {Object.entries(holdings).map(([name, tickers]) => (
          <details key={name} className="bg-white rounded-xl border border-[#E2E8F0] group">
            <summary className="px-5 py-4 cursor-pointer list-none flex items-center justify-between select-none">
              <div>
                <span className="text-sm font-semibold text-[#0F172A]">{name}</span>
                <span className="ml-2 text-xs text-[#64748B]">
                  {tickers.length}종목 · 감시목록 {tickers.filter(t => WL_MAP[t]).length}종목 포함
                </span>
              </div>
              <span className="text-[#64748B] text-xs transition-transform duration-200 group-open:rotate-90">▶</span>
            </summary>
            <div className="border-t border-[#E2E8F0]">
              <InvestorTable
                tickers={[...tickers].sort((a, b) => {
                  const sa = screenMap[a], sb = screenMap[b]
                  if ((sb?.buy_signal ?? 0) !== (sa?.buy_signal ?? 0)) return (sb?.buy_signal ?? 0) - (sa?.buy_signal ?? 0)
                  if ((sb?.overall_pass ?? 0) !== (sa?.overall_pass ?? 0)) return (sb?.overall_pass ?? 0) - (sa?.overall_pass ?? 0)
                  return (WL_MAP[a] ? 0 : 1) - (WL_MAP[b] ? 0 : 1)
                })}
                stockMap={stockMap}
                screenMap={screenMap}
                nameMap={nameMap}
                macro={macro}
                usdkrw={usdkrw}
              />
            </div>
          </details>
        ))}
      </div>

      <p className="text-[10px] text-[#94A3B8] mt-4">
        * DataRoma 기준 분기 1회 업데이트 권장 (3개월 시차). 파란색 티커 = 감시 종목, 회색 = 비추적 종목.<br />
        * 공통 보유: 2인 이상 보유 종목 자동 계산. 거시민감도는 경기침체 신호 감지 시에만 표시.
      </p>
    </div>
  )
}
