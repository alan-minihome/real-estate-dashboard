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

// ─── DGR 참고 가이드 ─────────────────────────────────────────────────────────

const DGR_GUIDE = [
  { type: '배당 귀족주 (25년+ 연속 인상)', range: '5~7%', dgr: 6,   examples: 'JNJ, KO, PG, MMM',       badge: 'bg-emerald-100 text-emerald-700' },
  { type: '빅테크 배당 성장주',            range: '8~12%', dgr: 10,  examples: 'MSFT, AAPL',             badge: 'bg-blue-100 text-blue-700' },
  { type: '경기방어 소비재',               range: '4~6%',  dgr: 5,   examples: 'PEP, CL, CLX',           badge: 'bg-blue-100 text-blue-700' },
  { type: '고배당 / 리츠',                range: '2~4%',  dgr: 3,   examples: 'O, MAIN, T',             badge: 'bg-amber-100 text-amber-700' },
  { type: 'S&P 500 역사적 평균',           range: '5~6%',  dgr: 5.5, examples: '— (기본 권장값)',         badge: 'bg-slate-100 text-slate-600' },
] as const

// ─── 목표 역산 시뮬레이터 ────────────────────────────────────────────────────

interface GoalTicker { ticker: string; weight: number }

function GoalSimulator({
  stockData, usdkrw, taxRate, allTickers,
}: {
  stockData: StockData[]
  usdkrw: number | null
  taxRate: number
  allTickers: { ticker: string; name: string }[]
}) {
  const [targetKRW, setTargetKRW] = useState(300)
  const [years, setYears] = useState(20)
  const [dgr, setDgr] = useState(7)
  const [mode, setMode] = useState<'single' | 'multi'>('single')
  const [singleTicker, setSingleTicker] = useState(allTickers[0]?.ticker || '')
  const [multiItems, setMultiItems] = useState<GoalTicker[]>(
    allTickers.slice(0, 2).map((t, i) => ({ ticker: t.ticker, weight: i === 0 ? 60 : 40 }))
  )
  const [showDgrGuide, setShowDgrGuide] = useState(false)

  const stockMap = useMemo(
    () => Object.fromEntries(stockData.map(s => [s.ticker, s])),
    [stockData]
  )

  const result = useMemo(() => {
    if (!usdkrw) return null
    const targetMonthlyUSD = (targetKRW * 10000) / usdkrw
    const targetAnnualNetUSD = targetMonthlyUSD * 12
    const targetAnnualGrossUSD = targetAnnualNetUSD / (1 - taxRate / 100)

    if (mode === 'single') {
      const s = stockMap[singleTicker]
      if (!s?.price || !s?.div_yield) return null
      const annualDPS = s.price * (s.div_yield / 100)
      if (annualDPS <= 0) return null
      const growthFactor = Math.pow(1 + dgr / 100, years)
      const monthlyShares = Math.ceil(targetAnnualGrossUSD / (12 * years * annualDPS * growthFactor))
      const monthlyInvestUSD = monthlyShares * s.price
      const rows = Array.from({ length: years }, (_, i) => {
        const y = i + 1
        const totalShares = monthlyShares * 12 * y
        const dps = annualDPS * Math.pow(1 + dgr / 100, y)
        const gross = totalShares * dps
        const net = gross * (1 - taxRate / 100)
        const monthly = net / 12
        const yoc = (gross / (monthlyInvestUSD * 12 * y)) * 100
        return { year: y, gross, net, monthly, yoc }
      })
      return {
        mode: 'single' as const,
        items: [{ ticker: singleTicker, name: allTickers.find(t => t.ticker === singleTicker)?.name || singleTicker, monthlyShares, monthlyInvestUSD, price: s.price }],
        totalMonthlyInvestUSD: monthlyInvestUSD,
        totalInvestUSD: monthlyInvestUSD * 12 * years,
        rows, targetAnnualGrossUSD, targetAnnualNetUSD,
      }
    }

    // 복수 종목
    const totalWeight = multiItems.reduce((acc, i) => acc + i.weight, 0)
    if (totalWeight <= 0) return null
    type ItemResult = { ticker: string; name: string; weight: number; monthlyShares: number; monthlyInvestUSD: number; price: number; annualDPS: number }
    const items: ItemResult[] = multiItems.flatMap(item => {
      const s = stockMap[item.ticker]
      if (!s?.price || !s?.div_yield) return []
      const annualDPS = s.price * (s.div_yield / 100)
      if (annualDPS <= 0) return []
      const itemTargetGross = targetAnnualGrossUSD * (item.weight / totalWeight)
      const growthFactor = Math.pow(1 + dgr / 100, years)
      const monthlyShares = Math.ceil(itemTargetGross / (12 * years * annualDPS * growthFactor))
      return [{ ticker: item.ticker, name: allTickers.find(t => t.ticker === item.ticker)?.name || item.ticker, weight: item.weight, monthlyShares, monthlyInvestUSD: monthlyShares * s.price, price: s.price, annualDPS }]
    })
    const totalMonthlyInvestUSD = items.reduce((acc, i) => acc + i.monthlyInvestUSD, 0)
    const rows = Array.from({ length: years }, (_, i) => {
      const y = i + 1
      let gross = 0
      items.forEach(item => { gross += item.monthlyShares * 12 * y * item.annualDPS * Math.pow(1 + dgr / 100, y) })
      const net = gross * (1 - taxRate / 100)
      const monthly = net / 12
      const invested = totalMonthlyInvestUSD * 12 * y
      return { year: y, gross, net, monthly, yoc: invested > 0 ? (gross / invested) * 100 : 0 }
    })
    return {
      mode: 'multi' as const,
      items,
      totalMonthlyInvestUSD,
      totalInvestUSD: totalMonthlyInvestUSD * 12 * years,
      rows, targetAnnualGrossUSD, targetAnnualNetUSD,
    }
  }, [targetKRW, years, dgr, mode, singleTicker, multiItems, stockMap, usdkrw, taxRate, allTickers])

  const totalWeight = multiItems.reduce((acc, i) => acc + i.weight, 0)

  const addMultiItem = () => {
    const used = new Set(multiItems.map(i => i.ticker))
    const next = allTickers.find(t => !used.has(t.ticker))
    if (next) setMultiItems(prev => [...prev, { ticker: next.ticker, weight: 20 }])
  }

  return (
    <div>
      {/* 목표 설정 */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-5">
        <p className="text-sm font-semibold text-[#0F172A] mb-4">🎯 목표 설정</p>
        <div className="grid grid-cols-3 gap-5">
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">목표 월 배당 (세후)</label>
            <div className="flex items-center gap-2">
              <input type="number" value={targetKRW} min={1} step={10}
                onChange={e => setTargetKRW(Number(e.target.value))}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#1A56DB]" />
              <span className="text-sm text-[#64748B] shrink-0">만원</span>
            </div>
            {usdkrw && <p className="text-[10px] text-[#64748B] mt-1">≈ {fmtUSD((targetKRW * 10000) / usdkrw)}/월</p>}
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">투자 기간</label>
            <div className="flex items-center gap-2">
              <input type="number" value={years} min={1} max={50}
                onChange={e => setYears(Number(e.target.value))}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#1A56DB]" />
              <span className="text-sm text-[#64748B] shrink-0">년</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">
              배당 성장률 (DGR){' '}
              <button onClick={() => setShowDgrGuide(v => !v)} className="text-[#1A56DB] font-bold">?</button>
            </label>
            <div className="flex items-center gap-2">
              <input type="number" value={dgr} min={0} max={30} step={0.5}
                onChange={e => setDgr(Number(e.target.value))}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#1A56DB]" />
              <span className="text-sm text-[#64748B] shrink-0">%</span>
            </div>
          </div>
        </div>
        {showDgrGuide && (
          <div className="mt-4 rounded-lg border border-[#E2E8F0] overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b border-[#E2E8F0]">
                <th className="px-3 py-2 text-left font-medium text-[#64748B]">종류</th>
                <th className="px-3 py-2 text-right font-medium text-[#64748B]">DGR 범위</th>
                <th className="px-3 py-2 text-left font-medium text-[#64748B]">대표 종목</th>
              </tr></thead>
              <tbody>
                {DGR_GUIDE.map(g => (
                  <tr key={g.type} className="border-b border-[#E2E8F0] last:border-0">
                    <td className="px-3 py-1.5 text-[#0F172A]">{g.type}</td>
                    <td className="px-3 py-1.5 text-right"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${g.badge}`}>{g.range}</span></td>
                    <td className="px-3 py-1.5 text-[#64748B]">{g.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {usdkrw && (
          <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex gap-6 text-xs text-[#64748B]">
            <span>목표 세후 <b className="text-[#0F172A]">{fmtKRW(targetKRW * 10000)}/월</b></span>
            <span>세전 환산 <b className="text-[#0F172A]">{fmtKRW((targetKRW * 10000) / (1 - taxRate / 100))}/월</b></span>
            <span>연간 세전 <b className="text-[#0F172A]">{result ? fmtUSD(result.targetAnnualGrossUSD) : '—'}</b></span>
          </div>
        )}
      </div>

      {/* 모드 토글 */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1">
        {([{ id: 'single', label: '🔍 단일 종목' }, { id: 'multi', label: '📋 복수 종목' }] as const).map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === m.id ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* 종목 설정 */}
      {mode === 'single' ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-5">
          <label className="block text-xs text-[#64748B] mb-2">종목 선택</label>
          <select value={singleTicker} onChange={e => setSingleTicker(e.target.value)}
            className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#1A56DB] w-72">
            {allTickers.map(t => <option key={t.ticker} value={t.ticker}>{t.ticker} — {t.name}</option>)}
          </select>
          {singleTicker && stockMap[singleTicker] && (
            <div className="mt-3 flex gap-5 text-xs text-[#64748B]">
              <span>현재가 <b className="text-[#0F172A]">{fmtUSD(stockMap[singleTicker].price ?? 0)}</b></span>
              <span>배당수익률 <b className="text-[#0F172A]">{fmtPct(stockMap[singleTicker].div_yield ?? 0)}</b></span>
              <span>연간 DPS <b className="text-[#0F172A]">{fmtUSD((stockMap[singleTicker].price ?? 0) * ((stockMap[singleTicker].div_yield ?? 0) / 100))}</b></span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#0F172A]">종목 구성</p>
            <div className="flex items-center gap-4">
              <span className={`text-xs font-medium ${Math.abs(totalWeight - 100) > 0.5 ? 'text-red-500' : 'text-emerald-600'}`}>
                비중 합계: {totalWeight}%
              </span>
              <button onClick={addMultiItem} className="text-xs text-[#1A56DB] hover:underline">+ 종목 추가</button>
            </div>
          </div>
          <div className="space-y-2">
            {multiItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <select value={item.ticker}
                  onChange={e => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, ticker: e.target.value } : it))}
                  className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#1A56DB]">
                  {allTickers.map(t => <option key={t.ticker} value={t.ticker}>{t.ticker} — {t.name}</option>)}
                </select>
                {stockMap[item.ticker] && (
                  <span className="text-xs text-[#64748B] shrink-0 w-24">{fmtPct(stockMap[item.ticker].div_yield ?? 0)} 배당</span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <input type="number" value={item.weight} min={0} max={100}
                    onChange={e => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, weight: Number(e.target.value) } : it))}
                    className="w-16 text-right border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm font-bold text-[#1A56DB] focus:outline-none focus:border-[#1A56DB]" />
                  <span className="text-sm text-[#64748B]">%</span>
                </div>
                <button onClick={() => setMultiItems(prev => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-red-500 text-xl leading-none shrink-0">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 결과 */}
      {result ? (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl border border-[#1A56DB] bg-blue-50 p-4">
              <p className="text-xs text-[#64748B] mb-1">월 필요 투자금</p>
              <p className="text-2xl font-bold tabular text-[#1A56DB]">
                {usdkrw ? fmtKRW(result.totalMonthlyInvestUSD * usdkrw) : fmtUSD(result.totalMonthlyInvestUSD)}
              </p>
              <p className="text-xs text-[#64748B] mt-0.5">{fmtUSD(result.totalMonthlyInvestUSD)}/월</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-xs text-[#64748B] mb-1">총 투자 원금 ({years}년)</p>
              <p className="text-2xl font-bold tabular text-[#0F172A]">
                {usdkrw ? fmtKRW(result.totalInvestUSD * usdkrw) : fmtUSD(result.totalInvestUSD)}
              </p>
              <p className="text-xs text-[#64748B] mt-0.5">{fmtUSD(result.totalInvestUSD)}</p>
            </div>
          </div>

          {/* 종목별 매월 구매 주수 */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50">
              <p className="text-sm font-semibold text-[#0F172A]">종목별 매월 구매 계획</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs">
                  <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">티커</th>
                  <th className="text-left px-3 py-2.5 font-medium text-[#64748B]">종목명</th>
                  {result.mode === 'multi' && <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">비중</th>}
                  <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">현재가</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">매월 구매</th>
                  <th className="text-right px-4 py-2.5 font-medium text-[#1A56DB]">월 투자금</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item, idx) => (
                  <tr key={item.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${idx % 2 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-4 py-3 font-bold text-[#1A56DB] text-xs">{item.ticker}</td>
                    <td className="px-3 py-3 text-[#0F172A]">{item.name}</td>
                    {result.mode === 'multi' && (
                      <td className="px-3 py-3 text-right text-xs text-[#64748B]">{'weight' in item ? `${(item as {weight: number}).weight}%` : ''}</td>
                    )}
                    <td className="px-3 py-3 text-right tabular text-[#64748B]">
                      <p>{fmtUSD(item.price)}</p>
                      {usdkrw && <p className="text-[10px]">{fmtKRW(item.price * usdkrw)}</p>}
                    </td>
                    <td className="px-3 py-3 text-right tabular font-bold text-[#0F172A] text-lg">{item.monthlyShares.toLocaleString()}주</td>
                    <td className="px-4 py-3 text-right tabular font-bold text-[#1A56DB]">
                      <p>{fmtUSD(item.monthlyInvestUSD)}</p>
                      {usdkrw && <p className="text-xs font-normal text-[#64748B]">{fmtKRW(item.monthlyInvestUSD * usdkrw)}</p>}
                    </td>
                  </tr>
                ))}
                {result.mode === 'multi' && result.items.length > 1 && (
                  <tr className="bg-blue-50/60 border-t-2 border-[#1A56DB] font-semibold text-sm">
                    <td colSpan={4} className="px-4 py-3 text-[#0F172A]">합계</td>
                    <td className="px-3 py-3 text-right tabular text-[#0F172A] text-lg">{result.items.reduce((a, i) => a + i.monthlyShares, 0).toLocaleString()}주</td>
                    <td className="px-4 py-3 text-right tabular text-[#1A56DB]">
                      <p>{fmtUSD(result.totalMonthlyInvestUSD)}</p>
                      {usdkrw && <p className="text-xs font-normal">{fmtKRW(result.totalMonthlyInvestUSD * usdkrw)}</p>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 연도별 배당 성장 테이블 */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0F172A]">연도별 배당 성장 예측</p>
              <p className="text-xs text-[#64748B]">목표 <span className="font-semibold text-[#0F172A]">{fmtKRW(targetKRW * 10000)}/월</span> (세후)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs">
                    <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">연도</th>
                    <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">연간배당 (세전)</th>
                    <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">연간배당 (세후)</th>
                    <th className="text-right px-3 py-2.5 font-medium text-[#1A56DB]">월평균 (세후)</th>
                    <th className="text-right px-4 py-2.5 font-medium text-[#64748B]">YOC</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => {
                    const isMilestone = r.year % 5 === 0
                    const isGoalYear = r.year === years
                    const monthlyKRW = usdkrw ? r.monthly * usdkrw : 0
                    const isReached = usdkrw ? monthlyKRW >= targetKRW * 10000 : false
                    return (
                      <tr key={r.year} className={`border-b border-[#E2E8F0] last:border-0 ${isGoalYear ? 'bg-blue-50/70 font-semibold' : isMilestone ? 'bg-slate-50/70' : i % 2 ? 'bg-slate-50/30' : ''}`}>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-medium ${isGoalYear ? 'text-[#1A56DB]' : 'text-[#64748B]'}`}>
                            {r.year}년차{isReached && !isGoalYear && <span className="ml-1 text-emerald-600 text-[10px]">✓</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-[#64748B]">
                          <p>{fmtUSD(r.gross)}</p>
                          {usdkrw && <p className="text-[10px]">{fmtKRW(r.gross * usdkrw)}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-[#64748B]">
                          <p>{fmtUSD(r.net)}</p>
                          {usdkrw && <p className="text-[10px]">{fmtKRW(r.net * usdkrw)}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular font-medium text-[#1A56DB]">
                          <p>{fmtUSD(r.monthly)}</p>
                          {usdkrw && (
                            <p className={`text-[10px] ${isReached ? 'text-emerald-600 font-bold' : 'text-[#64748B]'}`}>
                              {fmtKRW(monthlyKRW)}{isReached ? ' ✓' : ''}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular">
                          <span className={`text-xs font-medium ${r.yoc >= 10 ? 'text-emerald-600' : r.yoc >= 5 ? 'text-blue-600' : 'text-[#64748B]'}`}>
                            {r.yoc.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
            * 주가·배당수익률은 현재 데이터 기준으로 고정 가정합니다. DGR {dgr}%는 가정치이며 실제 배당은 분기별 선언 기준으로 변동됩니다.
            월 구매 주수는 목표 배당을 충족하도록 소수점 올림(ceil) 처리됩니다. ✓ 표시는 해당 연도에 월 목표를 최초 달성한 시점입니다.
          </p>
        </>
      ) : (
        <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-8 text-center">
          <p className="text-sm text-[#64748B]">종목을 선택하면 역산 결과가 표시됩니다.</p>
          <p className="text-xs text-slate-400 mt-1">배당수익률 데이터가 없는 종목은 계산에서 제외됩니다.</p>
        </div>
      )}
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

function SimulationContent() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'watchlist' | 'portfolio' | 'accum' | 'goal'>('watchlist')
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

  // 감시 종목 탭: 주수 입력
  const [globalShares, setGlobalShares] = useState(10)
  const [perStock, setPerStock] = useState<Record<string, number>>({})
  const [usePerStock, setUsePerStock] = useState(false)
  const [showAll, setShowAll] = useState(false)
  // 선택 제외 티커 (기본 전체 선택, 제외한 것만 추적)
  const [deselectedTickers, setDeselectedTickers] = useState<Set<string>>(new Set())

  // 적립 시뮬레이션 탭
  const [accumMode, setAccumMode] = useState<'single' | 'multi'>('single')
  const [accumTicker, setAccumTicker] = useState<string>('')
  const [accumInitialShares, setAccumInitialShares] = useState(0)
  const [accumMonthlyShares, setAccumMonthlyShares] = useState(1)
  const [accumYears, setAccumYears] = useState(10)
  const [accumDivGrowthRate, setAccumDivGrowthRate] = useState(5)
  const [accumDrip, setAccumDrip] = useState(false)
  const [accumShowDgrGuide, setAccumShowDgrGuide] = useState(false)
  const [accumStockSettings, setAccumStockSettings] = useState<
    Record<string, { selected: boolean; initialShares: number; monthlyShares: number }>
  >({})

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
    ]).then(([tc, stocksData, portData, marketData, candidatesData]) => {
      setTaxConfig(tc)
      setStockData(stocksData.stocks || [])
      setScreening(stocksData.screening || [])
      setCustomWatchlist(stocksData.customWatchlist || [])
      setPortfolio(Array.isArray(portData) ? portData : [])
      if (Array.isArray(candidatesData)) setCandidatesList(candidatesData)
      if (marketData?.USDKRW?.price) setUsdkrw(marketData.USDKRW.price)
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

  // 복수 종목 설정 초기화: stockData 로드 후 watchlist 종목에 기본값 세팅
  useEffect(() => {
    if (stockData.length === 0 && candidatesList.length === 0) return
    setAccumStockSettings(prev => {
      const next = { ...prev }
      const allTickers = [
        ...candidatesList.map(c => c.ticker),
        ...WATCHLIST.map(w => w.ticker),
      ]
      for (const ticker of allTickers) {
        if (!(ticker in next)) {
          next[ticker] = { selected: true, initialShares: 0, monthlyShares: 1 }
        }
      }
      return next
    })
  }, [stockData, candidatesList])

  // 적립 시뮬레이션 계산 (복수 종목)
  const accumMultiRows = useMemo(() => {
    if (accumMode !== 'multi') return []
    const selectedStocks = mergedList.filter(w => {
      const s = accumStockSettings[w.ticker]
      return (s?.selected !== false) && stockMap[w.ticker]?.price && stockMap[w.ticker]?.div_yield
    })
    if (selectedStocks.length === 0) return []

    const stockState: Record<string, { purchaseShares: number; dripShares: number; invested: number }> = {}
    for (const w of selectedStocks) {
      const settings = accumStockSettings[w.ticker] || { initialShares: 0, monthlyShares: 1 }
      const price = stockMap[w.ticker]!.price!
      stockState[w.ticker] = { purchaseShares: settings.initialShares, dripShares: 0, invested: settings.initialShares * price }
    }

    const rows: Array<{
      year: number; grossDividend: number; netDividend: number
      monthlyNet: number; totalInvested: number
      perStock: Record<string, { gross: number; net: number; shares: number }>
    }> = []

    for (let y = 1; y <= accumYears; y++) {
      let totalGross = 0, totalNet = 0, totalInvested = 0
      const perStock: Record<string, { gross: number; net: number; shares: number }> = {}
      for (const w of selectedStocks) {
        const settings = accumStockSettings[w.ticker] || { initialShares: 0, monthlyShares: 1 }
        const stock = stockMap[w.ticker]!
        const price = stock.price!, currentYield = stock.div_yield! / 100
        const state = stockState[w.ticker]
        state.purchaseShares += settings.monthlyShares * 12
        state.invested += settings.monthlyShares * 12 * price
        const totalShares = state.purchaseShares + state.dripShares
        const divPerShare = price * currentYield * Math.pow(1 + accumDivGrowthRate / 100, y - 1)
        const gross = totalShares * divPerShare
        const net = gross * (1 - taxRate / 100)
        if (accumDrip) state.dripShares += gross / price
        totalGross += gross; totalNet += net; totalInvested += state.invested
        perStock[w.ticker] = { gross, net, shares: totalShares }
      }
      rows.push({ year: y, grossDividend: totalGross, netDividend: totalNet, monthlyNet: totalNet / 12, totalInvested, perStock })
    }
    return rows
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accumMode, accumStockSettings, accumYears, accumDivGrowthRate, accumDrip, taxRate, stockData, candidatesList])

  // 적립 시뮬레이션 계산 (단일 종목)
  const accumStock = stockMap[accumTicker]
  const accumRows = useMemo(() => {
    const stock = stockMap[accumTicker]
    if (!accumTicker || !stock?.price || !stock?.div_yield) return []
    const price = stock.price
    const currentYield = stock.div_yield / 100

    let runningPurchaseShares = accumInitialShares
    let runningDripShares = 0
    let runningInvested = accumInitialShares * price

    const rows: Array<{
      year: number; shares: number; totalInvested: number
      divPerShare: number; grossDividend: number; netDividend: number
      monthlyNet: number; cumulativeDrip: number
    }> = []

    for (let y = 1; y <= accumYears; y++) {
      runningPurchaseShares += accumMonthlyShares * 12
      runningInvested += accumMonthlyShares * 12 * price

      const totalShares = runningPurchaseShares + runningDripShares
      // 배당 성장률: 1년차는 현재 yield 기준, 이후 매년 복리 적용
      const divPerShare = price * currentYield * Math.pow(1 + accumDivGrowthRate / 100, y - 1)
      const grossDividend = totalShares * divPerShare
      const netDividend = grossDividend * (1 - taxRate / 100)

      // DRIP: 세전 배당금으로 추가 매수 (현재가 기준)
      if (accumDrip) runningDripShares += grossDividend / price

      rows.push({
        year: y,
        shares: totalShares,
        totalInvested: runningInvested,
        divPerShare,
        grossDividend,
        netDividend,
        monthlyNet: netDividend / 12,
        cumulativeDrip: runningDripShares,
      })
    }
    return rows
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accumTicker, accumInitialShares, accumMonthlyShares, accumYears, accumDivGrowthRate, accumDrip, taxRate, stockData])

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
          { id: 'accum', label: '📈 적립 시뮬레이션' },
          { id: 'goal', label: '🎯 목표 역산' },
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

      {/* ── 적립 시뮬레이션 탭 ── */}
      {tab === 'accum' && (
        <>
          {/* 모드 토글 */}
          <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1">
            {([
              { id: 'single', label: '🔍 단일 종목' },
              { id: 'multi',  label: '📋 복수 종목' },
            ] as const).map(m => (
              <button key={m.id} onClick={() => setAccumMode(m.id)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  accumMode === m.id ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#64748B] hover:text-[#0F172A]'
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* ─ 단일 종목: 종목 선택 + 초기/월 주수 ─ */}
          {accumMode === 'single' && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-4">
              <p className="text-sm font-semibold text-[#0F172A] mb-3">종목 선택</p>
              <select value={accumTicker} onChange={e => setAccumTicker(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A56DB] bg-white mb-4">
                <option value="">— 종목을 선택하세요 —</option>
                {mergedList.filter(w => stockMap[w.ticker]?.price && stockMap[w.ticker]?.div_yield).map(w => {
                  const s = stockMap[w.ticker]
                  return (
                    <option key={w.ticker} value={w.ticker}>
                      {w.ticker} — {w.name} (배당률 {s.div_yield!.toFixed(2)}% / {fmtUSD(s.price!)})
                    </option>
                  )
                })}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#64748B] mb-1 block">초기 보유 주수</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={accumInitialShares}
                      onChange={e => setAccumInitialShares(Math.max(0, Number(e.target.value)))}
                      className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-[#1A56DB]" />
                    <span className="text-xs text-[#64748B] shrink-0">주</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#64748B] mb-1 block">월 구매 주수</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" value={accumMonthlyShares}
                      onChange={e => setAccumMonthlyShares(Math.max(1, Number(e.target.value)))}
                      className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-[#1A56DB]" />
                    <span className="text-xs text-[#64748B] shrink-0">주/월</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─ 복수 종목: 종목 테이블 ─ */}
          {accumMode === 'multi' && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <input type="checkbox"
                    checked={mergedList.filter(w => stockMap[w.ticker]?.price && stockMap[w.ticker]?.div_yield)
                      .every(w => accumStockSettings[w.ticker]?.selected !== false)}
                    onChange={e => {
                      setAccumStockSettings(prev => {
                        const next = { ...prev }
                        for (const w of mergedList) {
                          if (stockMap[w.ticker]?.price && stockMap[w.ticker]?.div_yield) {
                            next[w.ticker] = { ...(next[w.ticker] || { initialShares: 0, monthlyShares: 1 }), selected: e.target.checked }
                          }
                        }
                        return next
                      })
                    }}
                    className="rounded accent-[#1A56DB] cursor-pointer" />
                  <span className="text-sm font-semibold text-[#0F172A]">종목 선택</span>
                  <span className="text-xs text-[#64748B]">
                    ({mergedList.filter(w => stockMap[w.ticker]?.price && stockMap[w.ticker]?.div_yield && accumStockSettings[w.ticker]?.selected !== false).length}종목 선택됨)
                  </span>
                </div>
                <p className="text-xs text-[#64748B]">종목별 초기 주수·월 구매 주수 설정</p>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-[#E2E8F0] text-xs">
                    <tr>
                      <th className="w-10 px-3 py-2" />
                      <th className="text-left px-3 py-2 font-medium text-[#64748B]">티커</th>
                      <th className="text-left px-3 py-2 font-medium text-[#64748B]">종목명</th>
                      <th className="text-right px-3 py-2 font-medium text-[#64748B]">배당률</th>
                      <th className="text-right px-3 py-2 font-medium text-[#64748B]">초기 주수</th>
                      <th className="text-right px-3 py-2 font-medium text-[#64748B]">월 구매</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedList.filter(w => stockMap[w.ticker]?.price && stockMap[w.ticker]?.div_yield).map((w, i) => {
                      const s = stockMap[w.ticker]
                      const cfg = accumStockSettings[w.ticker] || { selected: true, initialShares: 0, monthlyShares: 1 }
                      const isSelected = cfg.selected !== false
                      return (
                        <tr key={w.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${!isSelected ? 'opacity-40' : i % 2 ? 'bg-slate-50/40' : ''}`}>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={isSelected}
                              onChange={e => setAccumStockSettings(prev => ({
                                ...prev,
                                [w.ticker]: { ...(prev[w.ticker] || { initialShares: 0, monthlyShares: 1 }), selected: e.target.checked }
                              }))}
                              className="rounded accent-[#1A56DB] cursor-pointer" />
                          </td>
                          <td className="px-3 py-2 font-bold text-[#1A56DB] text-xs">{w.ticker}</td>
                          <td className="px-3 py-2 text-[#0F172A] text-xs">{w.name}</td>
                          <td className="px-3 py-2 text-right text-xs text-emerald-600 tabular">{fmtPct(s.div_yield!)}</td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" min="0" value={cfg.initialShares}
                              onChange={e => setAccumStockSettings(prev => ({
                                ...prev,
                                [w.ticker]: { ...(prev[w.ticker] || { selected: true, monthlyShares: 1 }), initialShares: Math.max(0, Number(e.target.value)) }
                              }))}
                              className="w-16 border border-[#E2E8F0] rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-[#1A56DB]" />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input type="number" min="0" value={cfg.monthlyShares}
                                onChange={e => setAccumStockSettings(prev => ({
                                  ...prev,
                                  [w.ticker]: { ...(prev[w.ticker] || { selected: true, initialShares: 0 }), monthlyShares: Math.max(0, Number(e.target.value)) }
                                }))}
                                className="w-16 border border-[#E2E8F0] rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-[#1A56DB]" />
                              <span className="text-[10px] text-[#64748B]">주</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─ 공통 설정: 기간 · DGR · DRIP ─ */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-6">
            <p className="text-sm font-semibold text-[#0F172A] mb-3">공통 설정</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-[#64748B] mb-1 block">목표 기간</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="30" value={accumYears}
                    onChange={e => setAccumYears(Math.min(30, Math.max(1, Number(e.target.value))))}
                    className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-[#1A56DB]" />
                  <span className="text-xs text-[#64748B] shrink-0">년</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#64748B] mb-1 block">연간 배당성장률 (DGR)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="30" step="0.5" value={accumDivGrowthRate}
                    onChange={e => setAccumDivGrowthRate(Math.max(0, Number(e.target.value)))}
                    className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-[#1A56DB]" />
                  <span className="text-xs text-[#64748B] shrink-0">%/년</span>
                </div>
              </div>
              <div className="flex flex-col justify-start">
                <label className="text-xs text-[#64748B] mb-2 block">배당 재투자 (DRIP)</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={accumDrip} onChange={e => setAccumDrip(e.target.checked)}
                    className="rounded accent-[#1A56DB]" />
                  <span className="text-sm text-[#0F172A]">배당금으로 추가 매수</span>
                </label>
                <p className="text-[10px] text-slate-400 mt-1">세전 배당금 / 현재 주가 기준</p>
              </div>
            </div>

            {/* DGR 참고 가이드 */}
            <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
              <button onClick={() => setAccumShowDgrGuide(v => !v)}
                className="text-xs text-[#1A56DB] hover:underline flex items-center gap-1.5">
                <span>📖 배당성장률(DGR) 참고값</span>
                <span className="text-[10px]">{accumShowDgrGuide ? '▲ 접기' : '▼ 펼치기'}</span>
              </button>
              {accumShowDgrGuide && (
                <div className="mt-3">
                  <div className="grid grid-cols-1 gap-1.5">
                    {DGR_GUIDE.map(g => (
                      <div key={g.type} className="flex items-center gap-3 py-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${g.badge}`}>
                          {g.range}
                        </span>
                        <span className="text-xs text-[#0F172A] flex-1">{g.type}</span>
                        <span className="text-[11px] text-[#64748B] shrink-0">{g.examples}</span>
                        <button
                          onClick={() => setAccumDivGrowthRate(g.dgr)}
                          className="text-[10px] text-[#1A56DB] border border-blue-200 hover:bg-blue-50 px-2 py-0.5 rounded-full shrink-0 transition-colors">
                          {g.dgr}% 적용
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    * 높은 배당률(4%+) 종목은 대체로 DGR이 낮고, 낮은 배당률(1~2%) 종목은 DGR이 높은 경향이 있습니다.
                    보수적 시나리오 3~4% / 기본 5~6% / 낙관적 8~10%
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ─ 결과 섹션 ─ */}
          {(() => {
            const activeRows = accumMode === 'single' ? accumRows : accumMultiRows
            const noData = accumMode === 'single'
              ? !accumTicker
              : accumMultiRows.length === 0

            if (noData) return (
              <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-10 text-center">
                <p className="text-2xl mb-3">📈</p>
                <p className="text-sm font-medium text-[#0F172A] mb-1">
                  {accumMode === 'single' ? '종목을 선택하면 시뮬레이션이 시작됩니다' : '종목을 1개 이상 선택하세요'}
                </p>
                <p className="text-xs text-[#64748B]">월 N주씩 N년 지속 구매 시 예상 배당 수익을 연차별로 계산합니다</p>
              </div>
            )

            const milestones = [activeRows[0], activeRows[4], activeRows[activeRows.length - 1]]
              .filter((r, i, arr) => r !== undefined && arr.findIndex(a => a?.year === r?.year) === i)
              .filter(Boolean)

            return (
              <>
                {/* 단일 종목 현황 배너 */}
                {accumMode === 'single' && accumStock?.price && accumStock?.div_yield && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 mb-6 flex items-center gap-6 flex-wrap">
                    <div><p className="text-[10px] text-[#64748B]">종목</p><p className="text-sm font-bold text-[#1A56DB]">{accumTicker}</p></div>
                    <div>
                      <p className="text-[10px] text-[#64748B]">현재가</p>
                      <p className="text-sm font-bold text-[#0F172A]">{fmtUSD(accumStock.price)}</p>
                      {usdkrw && <p className="text-[10px] text-[#64748B]">{fmtKRW(accumStock.price * usdkrw)}</p>}
                    </div>
                    <div><p className="text-[10px] text-[#64748B]">배당률</p><p className="text-sm font-bold text-emerald-600">{fmtPct(accumStock.div_yield)}</p></div>
                    <div><p className="text-[10px] text-[#64748B]">주당 연간 배당</p><p className="text-sm font-bold text-[#0F172A]">{fmtUSD(accumStock.price * accumStock.div_yield / 100)}</p></div>
                    <div>
                      <p className="text-[10px] text-[#64748B]">월 투자금액 ({accumMonthlyShares}주)</p>
                      <p className="text-sm font-bold text-[#0F172A]">{fmtUSD(accumMonthlyShares * accumStock.price)}</p>
                      {usdkrw && <p className="text-[10px] text-[#64748B]">{fmtKRW(accumMonthlyShares * accumStock.price * usdkrw)}/월</p>}
                    </div>
                  </div>
                )}

                {/* 마일스톤 카드 */}
                <div className={`grid grid-cols-${milestones.length} gap-4 mb-6`}>
                  {milestones.map(m => {
                    if (!m) return null
                    const isFinal = m.year === accumYears
                    return (
                      <div key={m.year} className={`rounded-xl border p-4 ${isFinal ? 'border-[#1A56DB] bg-blue-50' : 'border-[#E2E8F0] bg-white'}`}>
                        <p className="text-xs text-[#64748B] mb-0.5">{m.year}년차{isFinal && m.year > 1 ? ' (목표)' : ''}</p>
                        <p className={`text-lg font-bold tabular ${isFinal ? 'text-[#1A56DB]' : 'text-[#0F172A]'}`}>{fmtUSD(m.netDividend)}</p>
                        {usdkrw && <p className="text-xs text-[#64748B] mt-0.5">{fmtKRW(m.netDividend * usdkrw)}</p>}
                        <div className="mt-2 pt-2 border-t border-[#E2E8F0] space-y-0.5">
                          <p className="text-[11px] text-[#64748B]">월평균 {fmtUSD(m.monthlyNet)}</p>
                          {usdkrw && <p className="text-[10px] text-slate-400">{fmtKRW(m.monthlyNet * usdkrw)}/월</p>}
                          <p className="text-[11px] text-[#64748B]">투자 {fmtUSD(m.totalInvested)}</p>
                          {'shares' in m && (
                            <p className="text-[11px] text-[#64748B]">
                              {Math.round((m as typeof accumRows[0]).shares)}주
                              {accumDrip && (m as typeof accumRows[0]).cumulativeDrip > 0 && (
                                <span className="text-emerald-600"> +{Math.round((m as typeof accumRows[0]).cumulativeDrip)}주 DRIP</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 연차별 테이블 */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-auto max-h-[500px]">
                  <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white z-10">
                    <p className="text-sm font-semibold text-[#0F172A]">
                      연차별 적립 현황
                      <span className="ml-2 text-xs font-normal text-[#64748B]">
                        {accumMode === 'single' ? `${accumTicker} · 월 ${accumMonthlyShares}주` : `${Object.values(accumStockSettings).filter(s => s.selected !== false).length}종목`}
                        {` · ${accumYears}년 · DGR ${accumDivGrowthRate}%${accumDrip ? ' · DRIP' : ''}`}
                      </span>
                    </p>
                    <span className="text-xs text-[#64748B]">세율 {taxRate}%</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs sticky top-[57px] z-10">
                        <th className="text-center px-4 py-3 font-medium text-[#64748B]">연차</th>
                        {accumMode === 'single' && <th className="text-right px-3 py-3 font-medium text-[#64748B]">누적 주수</th>}
                        {accumMode === 'single' && accumDrip && <th className="text-right px-3 py-3 font-medium text-emerald-600">DRIP</th>}
                        {accumMode === 'single' && <th className="text-right px-3 py-3 font-medium text-[#64748B]">주당 배당</th>}
                        <th className="text-right px-3 py-3 font-medium text-[#64748B]">연간배당 (세전)</th>
                        <th className="text-right px-3 py-3 font-medium text-[#64748B]">세금</th>
                        <th className="text-right px-3 py-3 font-medium text-[#1A56DB]">연간배당 (세후)</th>
                        <th className="text-right px-3 py-3 font-medium text-[#64748B]">월평균 (세후)</th>
                        <th className="text-right px-4 py-3 font-medium text-[#64748B]">총 투자비용</th>
                        <th className="text-right px-4 py-3 font-medium text-[#64748B]">실효수익률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRows.map((r, i) => {
                        const taxAmt = r.grossDividend - r.netDividend
                        const yoc = r.totalInvested > 0 ? (r.netDividend / r.totalInvested) * 100 : 0
                        const isMilestone = r.year === 1 || r.year === 5 || r.year === accumYears
                        const singleR = 'shares' in r ? r as typeof accumRows[0] : null
                        return (
                          <tr key={r.year} className={`border-b border-[#E2E8F0] last:border-0 ${
                            r.year === accumYears ? 'bg-blue-50/70 font-semibold' : isMilestone ? 'bg-slate-50/70' : i % 2 ? 'bg-slate-50/30' : ''
                          }`}>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`text-xs font-medium ${r.year === accumYears ? 'text-[#1A56DB]' : 'text-[#64748B]'}`}>{r.year}년차</span>
                            </td>
                            {singleR && <td className="px-3 py-2.5 text-right tabular text-[#0F172A]">{Math.round(singleR.shares).toLocaleString()}주</td>}
                            {singleR && accumDrip && (
                              <td className="px-3 py-2.5 text-right tabular text-emerald-600 text-xs">+{Math.round(singleR.cumulativeDrip)}주</td>
                            )}
                            {singleR && <td className="px-3 py-2.5 text-right tabular text-[#64748B] text-xs">{fmtUSD(singleR.divPerShare)}</td>}
                            <td className="px-3 py-2.5 text-right tabular text-[#64748B]">
                              <p>{fmtUSD(r.grossDividend)}</p>
                              {usdkrw && <p className="text-[10px]">{fmtKRW(r.grossDividend * usdkrw)}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular text-red-500 text-xs">-{fmtUSD(taxAmt)}</td>
                            <td className="px-3 py-2.5 text-right tabular text-[#1A56DB] font-medium">
                              <p>{fmtUSD(r.netDividend)}</p>
                              {usdkrw && <p className="text-[10px] font-normal text-[#64748B]">{fmtKRW(r.netDividend * usdkrw)}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular text-[#0F172A] text-xs">
                              <p>{fmtUSD(r.monthlyNet)}</p>
                              {usdkrw && <p className="text-[10px] text-[#64748B]">{fmtKRW(r.monthlyNet * usdkrw)}</p>}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular text-[#64748B] text-xs">
                              <p>{fmtUSD(r.totalInvested)}</p>
                              {usdkrw && <p className="text-[10px]">{fmtKRW(r.totalInvested * usdkrw)}</p>}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular">
                              <span className={`text-xs font-medium ${yoc >= 10 ? 'text-emerald-600' : yoc >= 5 ? 'text-blue-600' : 'text-[#64748B]'}`}>
                                {yoc.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 복수 종목: 목표연도 종목별 상세 */}
                {accumMode === 'multi' && accumMultiRows.length > 0 && (() => {
                  const finalRow = accumMultiRows[accumMultiRows.length - 1]
                  const stockEntries = Object.entries(finalRow.perStock)
                    .map(([ticker, data]) => ({ ticker, ...data, name: mergedList.find(w => w.ticker === ticker)?.name || ticker }))
                    .sort((a, b) => b.net - a.net)
                  return (
                    <div className="mt-5 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                      <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50">
                        <p className="text-sm font-semibold text-[#0F172A]">
                          {accumYears}년차 종목별 기여 상세
                          <span className="ml-2 text-xs font-normal text-[#64748B]">목표 연도 배당 분해</span>
                        </p>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs">
                            <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">티커</th>
                            <th className="text-left px-3 py-2.5 font-medium text-[#64748B]">종목명</th>
                            <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">누적 주수</th>
                            <th className="text-right px-3 py-2.5 font-medium text-[#64748B]">연간배당 (세전)</th>
                            <th className="text-right px-3 py-2.5 font-medium text-[#1A56DB]">연간배당 (세후)</th>
                            <th className="text-right px-4 py-2.5 font-medium text-[#64748B]">비중</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockEntries.map((s, i) => (
                            <tr key={s.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                              <td className="px-4 py-2.5 font-bold text-[#1A56DB] text-xs">{s.ticker}</td>
                              <td className="px-3 py-2.5 text-[#0F172A] text-xs">{s.name}</td>
                              <td className="px-3 py-2.5 text-right tabular text-xs">{Math.round(s.shares).toLocaleString()}주</td>
                              <td className="px-3 py-2.5 text-right tabular text-[#64748B] text-xs">
                                <p>{fmtUSD(s.gross)}</p>
                                {usdkrw && <p className="text-[10px]">{fmtKRW(s.gross * usdkrw)}</p>}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular font-medium text-[#1A56DB] text-xs">
                                <p>{fmtUSD(s.net)}</p>
                                {usdkrw && <p className="text-[10px] font-normal text-[#64748B]">{fmtKRW(s.net * usdkrw)}</p>}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular text-xs text-[#64748B]">
                                {finalRow.netDividend > 0 ? ((s.net / finalRow.netDividend) * 100).toFixed(1) : 0}%
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-blue-50/60 border-t-2 border-[#1A56DB] font-semibold">
                            <td colSpan={4} className="px-4 py-2.5 text-sm text-[#0F172A]">합계</td>
                            <td className="px-3 py-2.5 text-right tabular text-[#1A56DB]">
                              <p>{fmtUSD(finalRow.netDividend)}</p>
                              {usdkrw && <p className="text-xs font-normal text-[#64748B]">{fmtKRW(finalRow.netDividend * usdkrw)}</p>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                })()}

                {/* 가정 안내 */}
                <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                  * 주가는 현재가 기준으로 고정 가정합니다 (주가 상승분 미반영). DGR {accumDivGrowthRate}%는 가정치이며 실제 배당은 분기별 선언 기준으로 변동됩니다.
                  {accumDrip && ' DRIP은 세전 배당금을 현재 주가로 재투자하는 방식으로 계산됩니다.'}
                </p>
              </>
            )
          })()}
        </>
      )}


      {/* ── 목표 역산 탭 ── */}
      {tab === 'goal' && (
        <GoalSimulator
          stockData={stockData}
          usdkrw={usdkrw}
          taxRate={taxRate}
          allTickers={mergedList.map(w => ({ ticker: w.ticker, name: w.name }))}
        />
      )}

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
