'use client'

import { useEffect, useState } from 'react'
import { CRITERIA_CATALOG } from '@/lib/criteria'
import { WATCHLIST } from '@/lib/watchlist'
import VerdictBadge from '@/app/components/VerdictBadge'

interface Screening {
  ticker: string; overall_pass: number; buy_signal: number; signal_reason: string|null
  pass_payout: number; pass_div_growth: number; pass_peg: number; pass_de: number; pass_roe: number; pass_eps: number
  checks_json?: string | Record<string, number | null>
}

interface StockPrice {
  ticker: string; price: number | null; div_yield: number | null
}

interface HistoryEntry {
  id: number; updated_at: string; criteria: Record<string, number>; active_keys: string[]; memo: string
}

interface Snapshot {
  id: number; updated_at: string; memo: string
  results: Record<string, { overall_pass: number; pass_count: number }>
}

interface CustomItem { ticker: string; name: string; sector: string|null }

const PASS_KEY_MAP: Record<string, string> = {
  payout_ratio_max: 'pass_payout', div_growth_5y_min: 'pass_div_growth',
  peg_max: 'pass_peg', de_ratio_max: 'pass_de', roe_min: 'pass_roe', eps_growth_min: 'pass_eps',
}

function getPass(sc: Screening | undefined, criteriaKey: string): number | null {
  if (!sc) return null
  // 1. 레거시 컬럼 우선 (6개 기준)
  const legacyKey = PASS_KEY_MAP[criteriaKey]
  if (legacyKey) {
    const val = (sc as unknown as Record<string, number>)[legacyKey]
    if (val !== undefined && val !== null) return val
  }
  // 2. checks_json 파싱 (fcf_yield_min 등 동적 기준)
  if (sc.checks_json) {
    try {
      const checks: Record<string, number | null> = typeof sc.checks_json === 'string'
        ? JSON.parse(sc.checks_json)
        : sc.checks_json
      const val = checks[criteriaKey]
      if (val !== undefined) return val
    } catch { /* ignore */ }
  }
  return null
}

function CriteriaCard({ c, value, active, onToggle, onChange }: {
  c: typeof CRITERIA_CATALOG[0]
  value: number
  active: boolean
  onToggle: (active: boolean) => void
  onChange: (v: number) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-xl border p-4 transition-all ${active ? 'border-[#1A56DB] bg-blue-50/30' : 'border-[#E2E8F0] bg-white opacity-60'}`}>
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={active} onChange={e => onToggle(e.target.checked)}
            className="rounded accent-[#1A56DB]" />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">{c.label}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{c.desc}</p>
          </div>
        </label>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <span className={`text-sm font-bold tabular ${active ? 'text-[#1A56DB]' : 'text-slate-400'}`}>
            {c.direction === 'max' ? '≤' : '≥'} {value}{c.unit}
          </span>
          <button onClick={() => setOpen(o => !o)} className="text-slate-400 hover:text-slate-600 text-xs">
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* 슬라이더 */}
      <input type="range" min={c.min} max={c.max} step={c.step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        disabled={!active}
        className="w-full h-1.5 rounded-full accent-[#1A56DB] mb-2" />

      {/* 상세 설명 */}
      {open && (
        <div className="mt-2 pt-3 border-t border-[#E2E8F0] space-y-2">
          <p className="text-xs text-[#475569] leading-relaxed">{c.detail}</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-emerald-50 rounded-lg p-2">
              <p className="text-xs font-medium text-emerald-700 mb-0.5">✅ 통과 시</p>
              <p className="text-xs text-emerald-600">{c.goodSign}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-xs font-medium text-red-700 mb-0.5">❌ 미통과 시</p>
              <p className="text-xs text-red-600">{c.badSign}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ScreenerPage() {
  const [screening, setScreening] = useState<Screening[]>([])
  const [stockPrices, setStockPrices] = useState<Record<string, StockPrice>>({})
  const [customWatchlist, setCustomWatchlist] = useState<CustomItem[]>([])
  const [usdkrw, setUsdkrw] = useState<number | null>(null)
  const [criteria, setCriteria] = useState<Record<string, number>>({})
  const [activeKeys, setActiveKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(true)
  const [showGuide, setShowGuide] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [memo, setMemo] = useState('')
  const [candidateAdded, setCandidateAdded] = useState<Set<string>>(new Set())
  const [candidates, setCandidates] = useState<Array<Screening & { ticker: string; name: string; status: string; price?: number | null; div_yield?: number | null }>>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/stocks').then(r => r.json()),
      fetch('/api/criteria').then(r => r.json()),
      fetch('/api/criteria/history').then(r => r.json()),
      fetch('/api/criteria/snapshots').then(r => r.json()).catch(() => []),
      fetch('/api/market').then(r => r.json()).catch(() => null),
      fetch('/api/candidates').then(r => r.json()).catch(() => []),
    ])
      .then(([stocksData, criteriaData, histData, snapshotData, marketData, candidatesData]) => {
        setScreening(stocksData.screening || [])
        const pm: Record<string, StockPrice> = {}
        for (const s of (stocksData.stocks || [])) pm[s.ticker] = s
        setStockPrices(pm)
        setCustomWatchlist(stocksData.customWatchlist || [])
        if (Array.isArray(candidatesData)) {
          // 스크리닝 데이터 전체 보존 (pass_*, overall_pass, buy_signal, checks_json)
          setCandidates(candidatesData.filter((c: { status: string }) => c.status === 'watching'))
          setCandidateAdded(new Set(candidatesData.map((c: { ticker: string }) => c.ticker)))
        }
        if (marketData?.USDKRW?.price) setUsdkrw(marketData.USDKRW.price)
        if (criteriaData) {
          setCriteria(criteriaData.criteria || {})
          setActiveKeys(criteriaData.active_keys || [])
        } else {
          const defaults: Record<string, number> = {}
          const defaultActive: string[] = []
          CRITERIA_CATALOG.forEach(c => { defaults[c.key] = c.default; if (c.enabled) defaultActive.push(c.key) })
          setCriteria(defaults)
          setActiveKeys(defaultActive)
        }
        setHistory(Array.isArray(histData) ? histData : [])
        setSnapshots(Array.isArray(snapshotData) ? snapshotData : [])
      }).finally(() => setLoading(false))
  }, [])

  async function saveCriteria() {
    setSaving(true)
    await fetch('/api/criteria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria, active_keys: activeKeys, memo }),
    })
    // 이력 + 스냅샷 새로고침
    const [h, snap] = await Promise.all([
      fetch('/api/criteria/history').then(r => r.json()),
      fetch('/api/criteria/snapshots').then(r => r.json()).catch(() => []),
    ])
    setHistory(Array.isArray(h) ? h : [])
    setSnapshots(Array.isArray(snap) ? snap : [])
    setMemo('')
    setSaving(false)
  }

  function loadHistory(entry: HistoryEntry) {
    setCriteria(entry.criteria)
    setActiveKeys(entry.active_keys)
    setShowHistory(false)
  }

  // screening_results 우선 + candidates(universe_screening 폴백 적용된 응답) 보충
  const screenMap: Record<string, Screening> = Object.fromEntries(screening.map(s => [s.ticker, s]))
  for (const c of candidates as unknown as Array<Screening & { ticker: string }>) {
    if (!screenMap[c.ticker] && c.overall_pass !== undefined && c.overall_pass !== null) {
      screenMap[c.ticker] = c
    }
  }
  // stockPrices도 candidates에서 보충 (stock_data fetched_at 누락 종목 대비)
  for (const c of candidates as unknown as Array<{ ticker: string; price: number | null; div_yield: number | null }>) {
    if (!stockPrices[c.ticker] && c.price !== null && c.price !== undefined) {
      stockPrices[c.ticker] = { ticker: c.ticker, price: c.price, div_yield: c.div_yield }
    }
  }

  async function addToCandidate(ticker: string, name: string) {
    await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, name }),
    })
    setCandidateAdded(prev => new Set(prev).add(ticker))
  }

  // 후보함 + 감시종목(WATCHLIST + custom) 통합. 출처는 source 태그로 구분
  type MergedRow = { ticker: string; name: string; source: 'candidate' | 'watchlist' | 'custom' }
  const seen = new Set<string>()
  const mergedList: MergedRow[] = []
  for (const c of candidates) {
    if (seen.has(c.ticker)) continue
    seen.add(c.ticker)
    mergedList.push({ ticker: c.ticker, name: c.name, source: 'candidate' })
  }
  for (const w of WATCHLIST) {
    if (seen.has(w.ticker)) continue
    seen.add(w.ticker)
    mergedList.push({ ticker: w.ticker, name: w.name, source: 'watchlist' })
  }
  for (const c of customWatchlist) {
    if (seen.has(c.ticker)) continue
    seen.add(c.ticker)
    mergedList.push({ ticker: c.ticker, name: c.name || c.ticker, source: 'custom' })
  }

  const passed = mergedList.filter(w => screenMap[w.ticker]?.overall_pass === 1).length
  const activeCriteria = CRITERIA_CATALOG.filter(c => activeKeys.includes(c.key))

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">종목 스크리너</h1>
          <p className="text-sm text-[#64748B] mt-0.5">관심 종목 7기준 평가 + 임계값 튜닝 — 각 항목의 ▼를 눌러 기준 설명 확인</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGuide(g => !g)}
            className="px-3 py-2 border border-[#E2E8F0] text-sm text-[#64748B] rounded-lg hover:bg-slate-50 transition-colors">
            📖 기준 해설
          </button>
          <button onClick={() => setShowHistory(h => !h)}
            className="px-3 py-2 border border-[#E2E8F0] text-sm text-[#64748B] rounded-lg hover:bg-slate-50 transition-colors">
            🕘 변경 이력 {history.length > 0 && <span className="ml-1 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{history.length}</span>}
          </button>
          <button onClick={() => setShowCompare(c => !c)}
            className={`px-3 py-2 border text-sm rounded-lg transition-colors ${showCompare ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'}`}>
            📊 월별 비교 {snapshots.length > 0 && <span className="ml-1 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{snapshots.length}</span>}
          </button>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="메모 (선택)"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A56DB] w-32"
            />
            <button onClick={saveCriteria} disabled={saving}
              className="px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? '저장 중...' : '기준 저장'}
            </button>
          </div>
        </div>
      </div>

      {/* 스코프 안내 배너 — 신규 발굴과 차이 명시 */}
      <div className="mb-4 px-4 py-3 bg-slate-50 border border-[#E2E8F0] rounded-xl flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-[#475569]">
          <span className="font-medium text-[#0F172A]">📋 지금 보고 있는 것:</span>
          <span className="ml-1.5">
            관심 종목 <b className="text-[#1A56DB]">{mergedList.length}종목</b>
            {candidates.length > 0 && <span className="text-[#94A3B8]"> (후보함 {candidates.length})</span>}
            {customWatchlist.length > 0 && <span className="text-[#94A3B8]"> (감시 {customWatchlist.length})</span>}
          </span>
          <span className="ml-2 text-[#94A3B8]">— 7기준 평가 + 임계값 슬라이더 조정 가능</span>
        </div>
        <a
          href="/discover"
          className="text-xs text-[#1A56DB] hover:underline flex items-center gap-1 whitespace-nowrap"
        >
          🔭 S&P 500 전체에서 새 종목 찾기 →
        </a>
      </div>

      {/* 우량주 기준 해설 패널 */}
      {showGuide && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-amber-900 mb-3">📖 배당성장주 우량주 7가지 기준</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { n: '①', label: '배당성향 ≤ 70%', text: '이익의 70% 이내 배당 — 지속 성장 여력 확보' },
              { n: '②', label: '5년 배당성장률 ≥ 5%', text: '인플레이션(3%) 초과 성장 — 실질 구매력 유지' },
              { n: '③', label: 'PEG ≤ 1.5', text: '성장 대비 합리적 가격 — 안전마진 확보' },
              { n: '④', label: 'D/E ≤ 2', text: '낮은 부채 — 불황·금리 상승에도 배당 유지' },
              { n: '⑤', label: 'ROE ≥ 15%', text: '높은 자본 효율 — 지속적 경쟁 우위(해자) 보유' },
              { n: '⑥', label: 'EPS 성장률 ≥ 5%', text: '이익 성장이 배당 성장의 원천' },
              { n: '⑦', label: '현재 배당률 > 5년 평균', text: '역사적 저평가 구간 — 최적 매수 타이밍 신호' },
            ].map(item => (
              <div key={item.n} className="flex gap-2">
                <span className="text-amber-700 font-bold shrink-0">{item.n}</span>
                <div>
                  <p className="font-semibold text-amber-900">{item.label}</p>
                  <p className="text-amber-700 mt-0.5">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 변경 이력 패널 */}
      {showHistory && (
        <div className="mb-6 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0F172A]">🕘 기준 변경 이력</p>
            <p className="text-xs text-[#64748B]">행 클릭 시 해당 기준으로 복원</p>
          </div>
          <div className="divide-y divide-[#E2E8F0] max-h-80 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-sm text-[#64748B] px-5 py-4">저장 이력이 없습니다.</p>
            ) : history.map((h, i) => (
              <button
                key={h.id}
                onClick={() => loadHistory(h)}
                className="w-full text-left px-5 py-3 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {i === 0 && <span className="text-xs bg-[#1A56DB] text-white px-2 py-0.5 rounded-full">최신</span>}
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        {new Date(h.updated_at).toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        {h.memo && <span className="ml-2 text-[#64748B]">— {h.memo}</span>}
                      </p>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        활성 기준 {h.active_keys.length}개 ·{' '}
                        {CRITERIA_CATALOG
                          .filter(c => h.active_keys.includes(c.key))
                          .map(c => `${c.label} ${c.direction === 'max' ? '≤' : '≥'}${h.criteria[c.key]}${c.unit}`)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-[#1A56DB] shrink-0">복원 →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 월별 통과/탈락 비교 패널 */}
      {showCompare && (
        <div className="mb-6 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50">
            <p className="text-sm font-semibold text-[#0F172A]">📊 월별 통과/탈락 비교</p>
            <p className="text-xs text-[#64748B] mt-0.5">기준 저장 시점별 종목 통과 현황 — ↑ 신규통과 · ↓ 탈락 · → 유지</p>
          </div>
          {snapshots.length < 2 ? (
            <p className="text-sm text-[#64748B] px-5 py-6 text-center">
              기준을 2회 이상 저장하면 비교 데이터가 표시됩니다.
              <br /><span className="text-xs">기준 저장 시 자동으로 스냅샷이 기록됩니다.</span>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-slate-50/80">
                    <th className="text-left px-4 py-2 font-medium text-[#64748B] sticky left-0 bg-slate-50/80">종목</th>
                    {snapshots.map((snap, i) => (
                      <th key={snap.id} className="text-center px-3 py-2 font-medium text-[#64748B] min-w-[80px]">
                        <div>{new Date(snap.updated_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</div>
                        {snap.memo && <div className="text-[10px] font-normal text-slate-400 truncate max-w-[72px]">{snap.memo}</div>}
                        {i === snapshots.length - 1 && <div className="text-[10px] text-[#1A56DB]">최신</div>}
                      </th>
                    ))}
                    <th className="text-center px-3 py-2 font-medium text-[#64748B]">변화</th>
                  </tr>
                </thead>
                <tbody>
                  {WATCHLIST.map((w, ri) => {
                    const cells = snapshots.map(snap => snap.results[w.ticker]?.overall_pass ?? null)
                    const first = cells.find(c => c !== null)
                    const last = cells[cells.length - 1]
                    let change = '→'
                    let changeColor = 'text-slate-400'
                    if (first !== null && last !== null) {
                      if (first === 0 && last === 1) { change = '↑ 신규'; changeColor = 'text-emerald-600 font-bold' }
                      else if (first === 1 && last === 0) { change = '↓ 탈락'; changeColor = 'text-red-600 font-bold' }
                    }

                    // 변화가 있는 종목만 강조
                    const hasChange = change !== '→'

                    return (
                      <tr key={w.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${hasChange ? 'bg-amber-50/50' : ri % 2 ? 'bg-slate-50/30' : ''}`}>
                        <td className="px-4 py-2 font-bold text-[#1A56DB] sticky left-0 bg-inherit">{w.ticker}</td>
                        {snapshots.map((snap, si) => {
                          const pass = snap.results[w.ticker]?.overall_pass ?? null
                          const prevPass = si > 0 ? (snapshots[si - 1].results[w.ticker]?.overall_pass ?? null) : null
                          const changed = prevPass !== null && pass !== null && prevPass !== pass
                          return (
                            <td key={snap.id} className={`px-3 py-2 text-center ${changed ? 'bg-amber-100/60' : ''}`}>
                              {pass === null ? <span className="text-slate-300">–</span>
                                : pass === 1 ? <span className="text-emerald-600">✅</span>
                                : <span className="text-red-500">❌</span>}
                            </td>
                          )
                        })}
                        <td className={`px-3 py-2 text-center ${changeColor}`}>{change}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 기준 카드 그리드 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {CRITERIA_CATALOG.map(c => (
          <CriteriaCard
            key={c.key}
            c={c}
            value={criteria[c.key] ?? c.default}
            active={activeKeys.includes(c.key)}
            onToggle={on => setActiveKeys(prev => on ? [...prev, c.key] : prev.filter(k => k !== c.key))}
            onChange={v => setCriteria(prev => ({ ...prev, [c.key]: v }))}
          />
        ))}
      </div>

      {/* 결과 테이블 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">스크리닝 결과 — <span className="text-[#1A56DB]">{passed}</span>/{mergedList.length} 통과</h2>
        <label className="flex items-center gap-2 text-xs text-[#64748B] cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          전체 보기 (미통과 포함)
        </label>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs text-[#64748B] mb-2 px-1 flex-wrap">
        <span>✅ 기준 충족</span>
        <span>❌ 기준 미충족</span>
        <span className="text-amber-500 font-medium">❓ 데이터 없음 (API 미제공)</span>
        <span className="text-slate-400 font-medium">N/A 해당없음 (ETF·배당이력 부족)</span>
        <span className="text-slate-300">– 스크리닝 미실행</span>
      </div>

      {/* 매수신호 기준 설명 */}
      <div className="mb-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
        <span className="text-base">⚡</span>
        <span>
          <strong>매수신호 기준</strong>: 현재 배당률 &gt; 5년 평균 배당률 +{' '}
          <strong>{(criteria['yield_vs_avg_min'] ?? 1.0).toFixed(1)}%p</strong>
          {' '}— 주가가 역사적 평균 대비 저평가된 구간 (배당률이 평소보다 높다 = 주가가 내려왔다)
        </span>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-auto max-h-[600px]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E2E8F0] sticky top-0 z-20">
              <th className="text-left px-4 py-3 font-medium text-[#64748B] sticky left-0 z-30 bg-slate-50 border-r border-[#E2E8F0]">티커</th>
              <th className="text-left px-4 py-3 font-medium text-[#64748B] sticky left-[88px] z-30 bg-slate-50 border-r border-[#E2E8F0] min-w-[100px]">종목명</th>
              <th className="text-right px-3 py-3 font-medium text-[#64748B]">주가</th>
              {activeCriteria.map(c => (
                <th key={c.key} className="text-center px-3 py-3 font-medium text-[#64748B] text-xs">{c.label}</th>
              ))}
              <th className="text-center px-4 py-3 font-medium text-[#64748B]">통과</th>
              <th
                className="text-center px-4 py-3 font-medium text-[#64748B] cursor-help"
                title={`매수신호 = 현재 배당률 > 5년 평균 배당률 + ${(criteria['yield_vs_avg_min'] ?? 1.0).toFixed(1)}%p\n주가가 역사적 저평가 구간에 진입했다는 신호`}
              >
                매수신호 ⓘ
              </th>
              <th className="text-center px-4 py-3 font-medium text-[#64748B] min-w-[100px]">🎯 결과</th>
              <th className="text-center px-4 py-3 font-medium text-[#64748B]">후보 추가</th>
            </tr>
          </thead>
          <tbody>
            {[...mergedList]
              .filter(w => showAll || screenMap[w.ticker]?.overall_pass === 1)
              .map(w => {
                const sc = screenMap[w.ticker]
                const passCount = activeCriteria.filter(c => {
                  const p = c.key === 'yield_vs_avg_min' ? (sc?.buy_signal ? 1 : 0) : getPass(sc, c.key)
                  return p === 1
                }).length
                const naCount = activeCriteria.filter(c => getPass(sc, c.key) === -1).length
                return { w, sc, passCount, naCount }
              })
              .sort((a, b) => {
                if ((b.sc?.buy_signal ?? 0) !== (a.sc?.buy_signal ?? 0)) return (b.sc?.buy_signal ?? 0) - (a.sc?.buy_signal ?? 0)
                if ((b.sc?.overall_pass ?? 0) !== (a.sc?.overall_pass ?? 0)) return (b.sc?.overall_pass ?? 0) - (a.sc?.overall_pass ?? 0)
                return b.passCount - a.passCount
              })
              .map(({ w, sc, passCount, naCount }, i) => {
                const rowBg = sc?.buy_signal ? 'bg-emerald-50' : i % 2 ? 'bg-slate-50/50' : 'bg-white'
                return (
                  <tr key={w.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${rowBg}`}>
                    <td className={`px-4 py-3 font-bold text-[#1A56DB] sticky left-0 z-10 border-r border-[#E2E8F0] ${rowBg}`}>
                      {w.ticker}
                      {w.source === 'candidate' && <span className="ml-1 text-[10px] bg-blue-100 text-[#1A56DB] px-1.5 py-0.5 rounded-full align-middle">후보</span>}
                      {w.source === 'custom' && <span className="ml-1 text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full align-middle">감시</span>}
                    </td>
                    <td className={`px-4 py-3 text-[#0F172A] sticky left-[88px] z-10 border-r border-[#E2E8F0] min-w-[100px] ${rowBg}`}>{w.name}</td>
                    <td className="px-3 py-3 text-right tabular">
                      {stockPrices[w.ticker]?.price ? (
                        <div>
                          <p className="font-medium text-sm">${stockPrices[w.ticker].price!.toFixed(2)}</p>
                          {usdkrw && <p className="text-[10px] text-[#64748B]">₩{Math.round(stockPrices[w.ticker].price! * usdkrw).toLocaleString()}</p>}
                        </div>
                      ) : <span className="text-slate-300">–</span>}
                    </td>
                    {activeCriteria.map(c => {
                      // yield_vs_avg_min은 buy_signal로 판단 (checks_json에 없음)
                      const pass = c.key === 'yield_vs_avg_min'
                        ? (sc ? (sc.buy_signal ? 1 : 0) : null)
                        : getPass(sc, c.key)
                      return (
                        <td key={c.key} className="px-3 py-3 text-center">
                          {!sc
                            ? <span className="text-slate-300">–</span>
                            : pass === -1
                              ? <span className="text-slate-400 text-xs font-medium" title="ETF이거나 배당 이력이 5년 미만인 종목입니다">N/A</span>
                              : pass === null || pass === undefined
                                ? <span className="text-amber-400" title="API에서 데이터를 제공하지 않는 종목입니다">❓</span>
                                : pass ? '✅' : '❌'}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center font-medium">
                      {sc
                        ? sc.overall_pass
                          ? '✅'
                          : <span className="text-red-500 text-xs">❌ {passCount}/{activeCriteria.length - naCount}</span>
                        : <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sc?.buy_signal
                        ? <span title={sc.signal_reason ?? undefined} className="cursor-help text-base">⚡</span>
                        : <span className="text-slate-200 text-xs">–</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <VerdictBadge overallPass={sc?.overall_pass} buySignal={sc?.buy_signal} signalReason={sc?.signal_reason} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {candidateAdded.has(w.ticker) ? (
                        <span className="text-emerald-600 text-xs font-medium">✓ 추가됨</span>
                      ) : (
                        <button
                          onClick={() => addToCandidate(w.ticker, w.name)}
                          className="text-xs px-2 py-1 border border-[#1A56DB] text-[#1A56DB] rounded hover:bg-blue-50 whitespace-nowrap"
                        >+ 후보</button>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
