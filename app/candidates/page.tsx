'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import KumyungTaxBanner from '../components/KumyungTaxBanner'

const DIV_TAX_RATE = 15.4 // 배당소득세 원천징수율 (일반계좌 기준)

interface Candidate {
  id: number
  ticker: string
  name: string
  added_at: string
  target_shares: number
  memo: string
  status: string
  price: number | null
  div_yield: number | null
  div_yield_5y: number | null
  div_growth_5y: number | null
  payout_ratio: number | null
  fcf_payout_ratio: number | null
  overall_pass: number | null
  buy_signal: number | null
  signal_reason: string | null
}

interface IcrResult {
  icr: number | null
  ebit: number | null           // B$
  interest_expense: number | null  // B$
  error: string | null
}

interface EarningsFlag {
  type: string
  label: string
  severity: 'warning' | 'danger'
}

interface EarningsRisk {
  score: number
  risk_level: 'safe' | 'warning' | 'danger' | 'unknown'
  flags: EarningsFlag[]
  earnings_growth_pct: number | null
  error: string | null
}

interface EarningsEvent {
  id: number
  ticker: string
  reported_date: string
  headline: string | null
  summary: string | null
  eps_surprise_pct: number | null
  guidance_tone: 'positive' | 'neutral' | 'negative' | null
  source_url: string | null
  fetched_at: string
}

export default function CandidatesPage() {
  const router = useRouter()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [usdkrw, setUsdkrw] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editShares, setEditShares] = useState<number>(10)
  const [editMemo, setEditMemo] = useState<string>('')
  const [icrData, setIcrData] = useState<Record<string, IcrResult>>({})
  const [icrLoading, setIcrLoading] = useState(false)
  const [riskData, setRiskData] = useState<Record<string, EarningsRisk>>({})
  const [riskLoading, setRiskLoading] = useState(false)
  const [earningsEvents, setEarningsEvents] = useState<EarningsEvent[]>([])
  const [earningsTab, setEarningsTab] = useState<'recent' | 'history'>('recent')
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)
  const [showTiming, setShowTiming] = useState(true)

  async function load() {
    setLoading(true)
    const [cr, mr] = await Promise.all([
      fetch('/api/candidates').then(r => r.json()),
      fetch('/api/market').then(r => r.json()).catch(() => ({})),
    ])
    if (Array.isArray(cr)) {
      setCandidates(cr)
      // ICR은 watching 종목만 조회
      const watchingTickers = (cr as Candidate[])
        .filter(c => c.status === 'watching')
        .map(c => c.ticker)
      if (watchingTickers.length > 0) {
        const tStr = watchingTickers.join(',')
        setIcrLoading(true)
        fetch(`/api/icr?tickers=${tStr}`)
          .then(r => r.json())
          .then((d: Record<string, IcrResult>) => setIcrData(d))
          .catch(() => {})
          .finally(() => setIcrLoading(false))

        setRiskLoading(true)
        fetch(`/api/earnings-risk?tickers=${tStr}`)
          .then(r => r.json())
          .then((d: Record<string, EarningsRisk>) => setRiskData(d))
          .catch(() => {})
          .finally(() => setRiskLoading(false))

        // DB에 저장된 실적 뉴스 조회 (dividend-news-watcher 수집 결과)
        fetch(`/api/earnings-events?tickers=${tStr}`)
          .then(r => r.json())
          .then((d: EarningsEvent[]) => Array.isArray(d) && setEarningsEvents(d))
          .catch(() => {})
      }
    }
    if (mr?.USDKRW?.price) setUsdkrw(mr.USDKRW.price)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function remove(id: number) {
    await fetch(`/api/candidates/${id}`, { method: 'DELETE' })
    load()
  }

  async function markPurchased(id: number) {
    await fetch(`/api/candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'purchased' }),
    })
    load()
  }

  function startEdit(c: Candidate) {
    setEditingId(c.id)
    setEditShares(c.target_shares)
    setEditMemo(c.memo || '')
  }

  async function saveEdit(id: number) {
    await fetch(`/api/candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_shares: editShares, memo: editMemo }),
    })
    setEditingId(null)
    load()
  }

  // 시뮬레이션 페이지로 후보 데이터 전달 (URL 파라미터)
  function goSimulation() {
    const params = candidates
      .filter(c => c.status === 'watching')
      .map(c => `${c.ticker}:${c.target_shares}`)
      .join(',')
    router.push(`/simulation?candidates=${encodeURIComponent(params)}`)
  }

  function renderIcr(ticker: string) {
    if (icrLoading) return <span className="text-slate-300 text-xs">조회 중…</span>
    const d = icrData[ticker]
    if (!d) return <span className="text-slate-300">–</span>
    if (d.icr === null) {
      return <span className="text-slate-300 text-xs" title={d.error || '데이터 없음'}>–</span>
    }
    const v = d.icr
    const [cls, label] = v >= 5
      ? ['text-emerald-700 bg-emerald-50 border-emerald-200', '안전']
      : v >= 3
      ? ['text-amber-700 bg-amber-50 border-amber-200', '양호']
      : ['text-red-700 bg-red-50 border-red-200', '위험']
    const tip = `이자보상배율 ${v}x\nEBIT $${d.ebit}B ÷ 이자비용 $${d.interest_expense}B\n(≥5x 안전 · 3~5x 양호 · <3x 위험)`
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${cls}`}
        title={tip}
      >
        {v}x <span className="text-[10px] opacity-70">{label}</span>
      </span>
    )
  }

  function renderRisk(ticker: string) {
    if (riskLoading) return <span className="text-slate-300 text-xs">조회 중…</span>
    const d = riskData[ticker]
    if (!d) return <span className="text-slate-300">–</span>
    if (d.risk_level === 'unknown') return <span className="text-slate-300 text-xs" title={d.error || ''}>–</span>

    if (d.risk_level === 'safe') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium text-emerald-700 bg-emerald-50 border-emerald-200">
          ✅ 이상무
          {d.earnings_growth_pct !== null && (
            <span className="text-[10px] opacity-60">이익 +{d.earnings_growth_pct}%</span>
          )}
        </span>
      )
    }

    const hasDanger = d.flags.some(f => f.severity === 'danger')
    const tip = d.flags.map(f => f.label).join('\n')
    return (
      <div className="flex flex-col gap-0.5">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium cursor-help ${
            hasDanger
              ? 'text-red-700 bg-red-50 border-red-200'
              : 'text-amber-700 bg-amber-50 border-amber-200'
          }`}
          title={tip}
        >
          {hasDanger ? '🔴' : '⚠️'} {hasDanger ? '위험' : '주의'} ({d.flags.length}건)
        </span>
        {d.flags.map((f, i) => (
          <span key={i} className={`text-[10px] leading-tight ${f.severity === 'danger' ? 'text-red-500' : 'text-amber-600'}`}>
            · {f.label}
          </span>
        ))}
      </div>
    )
  }

  const watching = candidates.filter(c => c.status === 'watching')
  const purchased = candidates.filter(c => c.status === 'purchased')

  const totalAnnualDiv = watching.reduce((sum, c) => {
    if (!c.price || !c.div_yield) return sum
    return sum + (c.price * c.target_shares * c.div_yield / 100)
  }, 0)

  if (loading) return (
    <div className="p-8 text-[#64748B]">불러오는 중...</div>
  )

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">📋 예비 후보함</h1>
          <p className="text-sm text-[#64748B] mt-1">
            매수 전 관심 종목을 담아두고 시뮬레이션해보세요
          </p>
        </div>
        <div className="flex gap-3">
          {watching.length > 0 && (
            <button
              onClick={goSimulation}
              className="px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              🧮 시뮬레이션 실행
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      {watching.length > 0 && (() => {
        const netDiv = totalAnnualDiv * (1 - DIV_TAX_RATE / 100)
        const taxAmt = totalAnnualDiv - netDiv
        return (
          <>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                <p className="text-xs text-[#64748B]">관심 종목</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{watching.length}종목</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                <p className="text-xs text-[#64748B]">연간 배당 (세전)</p>
                <p className="text-xl font-bold text-[#0F172A] mt-1">${totalAnnualDiv.toFixed(0)}</p>
                {usdkrw && <p className="text-xs text-[#64748B]">₩{Math.round(totalAnnualDiv * usdkrw).toLocaleString()}</p>}
              </div>
              <div className="bg-blue-50 rounded-xl border border-[#1A56DB] p-4">
                <p className="text-xs text-[#64748B]">연간 배당 <span className="font-semibold text-[#1A56DB]">세후</span> ({DIV_TAX_RATE}% 차감)</p>
                <p className="text-xl font-bold text-[#1A56DB] mt-1">${netDiv.toFixed(0)}</p>
                {usdkrw && <p className="text-xs text-[#64748B]">₩{Math.round(netDiv * usdkrw).toLocaleString()}</p>}
                <p className="text-[10px] text-red-500 mt-0.5">세금 -${taxAmt.toFixed(0)}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                <p className="text-xs text-[#64748B]">매수신호 발생</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {watching.filter(c => c.buy_signal).length}종목 ⚡
                </p>
              </div>
            </div>
            {/* 금융소득종합과세 경고 */}
            <div className="mb-6">
              <KumyungTaxBanner annualGrossUsd={totalAnnualDiv} usdkrw={usdkrw} />
            </div>
          </>
        )
      })()}

      {/* 매수 타이밍 분석 */}
      {watching.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">⏱ 매수 타이밍 분석</h2>
              <p className="text-xs text-[#64748B] mt-0.5">배당률 vs 5년 평균 · YOC 복리 예측 · 최근 실적 요약</p>
            </div>
            <button
              onClick={() => setShowTiming(t => !t)}
              className="text-xs text-[#64748B] hover:text-slate-800 px-2 py-1"
            >
              {showTiming ? '접기 ▲' : '펼치기 ▼'}
            </button>
          </div>
          {showTiming && (
            <div className="grid grid-cols-2 gap-4 p-4">
              {watching.map(c => {
                const cur = c.div_yield
                const avg = c.div_yield_5y
                const dgr = c.div_growth_5y ?? 5
                const payout    = c.payout_ratio
                const fcfPayout = c.fcf_payout_ratio
                const diff = (cur != null && avg != null) ? cur - avg : null

                // 재무 부담 여부 (독립적으로 카드에 표시)
                const fundamentalStress =
                  (payout !== null && payout > 80) || (fcfPayout !== null && fcfPayout > 85)

                const zone: 'sell' | 'buy' | 'neutral' | 'caution' | 'unknown' =
                  diff == null ? 'unknown'
                  : diff <= -0.5 && fundamentalStress ? 'sell'
                  : diff >= 0.3 ? 'buy'
                  : diff >= -0.2 ? 'neutral'
                  : 'caution'

                const zoneConfig = {
                  sell:    { label: '매도검토',   borderCls: 'border-orange-300', bgCls: 'bg-orange-50',  textCls: 'text-orange-700', barCls: 'bg-orange-400', dot: '⛔' },
                  buy:     { label: '매수구간',   borderCls: 'border-emerald-300', bgCls: 'bg-emerald-50',  textCls: 'text-emerald-700', barCls: 'bg-emerald-400', dot: '🟢' },
                  neutral: { label: '적정',        borderCls: 'border-slate-200',   bgCls: 'bg-slate-50',   textCls: 'text-slate-600',   barCls: 'bg-blue-300',    dot: '⚪' },
                  caution: { label: '고평가주의',  borderCls: 'border-red-200',     bgCls: 'bg-red-50',     textCls: 'text-red-700',     barCls: 'bg-red-400',     dot: '🔴' },
                  unknown: { label: '데이터 없음', borderCls: 'border-slate-200',   bgCls: 'bg-slate-50',   textCls: 'text-slate-400',   barCls: 'bg-slate-200',   dot: '–' },
                }[zone]

                // 배당률 게이지: avg를 50% 기준점으로 설정, cur가 얼마나 이탈했는지 표시
                const barPct = (cur != null && avg != null && avg > 0)
                  ? Math.min(95, Math.max(5, 50 + ((cur - avg) / avg) * 120))
                  : 50

                // YOC 복리 계산
                const yoc = (years: number) => cur != null ? cur * Math.pow(1 + dgr / 100, years) : null

                // 최근 실적
                const evt = earningsEvents.find(e => e.ticker === c.ticker)

                return (
                  <div key={c.ticker} className={`rounded-xl border ${zoneConfig.borderCls} ${zoneConfig.bgCls} p-4`}>
                    {/* 헤더 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://finviz.com/quote.ashx?t=${c.ticker}`}
                          target="_blank" rel="noopener"
                          className="font-bold text-[#1A56DB] hover:underline"
                        >{c.ticker}</a>
                        <span className="text-xs text-[#64748B] truncate max-w-[120px]">{c.name}</span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white border ${zoneConfig.borderCls} ${zoneConfig.textCls}`}>
                        {zoneConfig.dot} {zoneConfig.label}
                      </span>
                    </div>

                    {/* 배당률 게이지 */}
                    {cur != null ? (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-[#64748B] mb-1">
                          <span>현재 <strong className={zoneConfig.textCls}>{cur.toFixed(2)}%</strong></span>
                          {avg != null && <span>5년 평균 {avg.toFixed(2)}%</span>}
                        </div>
                        <div className="relative h-3 bg-white rounded-full border border-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${zoneConfig.barCls}`}
                            style={{ width: `${barPct}%` }}
                          />
                          {/* 5년 평균 기준선 */}
                          <div className="absolute inset-y-0 w-px bg-slate-500 opacity-60" style={{ left: '50%' }} />
                        </div>
                        {diff != null && (
                          <p className={`text-[10px] mt-1 font-medium ${zoneConfig.textCls}`}>
                            5년 평균 대비 {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%p
                            {zone === 'buy' && ' — 역사적 저평가, 매수 타이밍'}
                            {zone === 'caution' && ' — 고평가 구간, 신규 진입 신중'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300 mb-3">배당률 데이터 없음</p>
                    )}

                    {/* YOC 복리 예측 */}
                    {cur != null && (
                      <div className="mb-3 p-2.5 bg-white/70 rounded-lg border border-slate-100">
                        <p className="text-[10px] font-medium text-[#64748B] mb-1.5">
                          📈 지금 매수 시 YOC 복리 예측 <span className="text-slate-400">(배당성장률 {dgr.toFixed(1)}%/yr 가정)</span>
                        </p>
                        <div className="grid grid-cols-4 gap-1 text-center">
                          {([['현재', cur], ['5년', yoc(5)], ['10년', yoc(10)], ['20년', yoc(20)]] as [string, number | null][]).map(([label, val]) => (
                            <div key={label} className="bg-slate-50 rounded p-1.5">
                              <p className="text-[9px] text-[#94A3B8] mb-0.5">{label}</p>
                              <p className={`text-xs font-bold tabular ${val != null && val >= 5 ? 'text-emerald-600' : val != null && val >= 3 ? 'text-blue-600' : 'text-[#0F172A]'}`}>
                                {val != null ? val.toFixed(1) + '%' : '–'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 재무 체력 — 배당성향 / FCF배당성향 */}
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      {payout !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                          payout > 80 ? 'bg-red-50 border-red-200 text-red-700'
                          : payout > 65 ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`} title="배당성향 (EPS 기준) — 80% 초과 시 위험">
                          배당성향 {payout.toFixed(1)}%
                        </span>
                      )}
                      {fcfPayout !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                          fcfPayout > 85 ? 'bg-red-50 border-red-200 text-red-700'
                          : fcfPayout > 70 ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`} title="FCF 배당성향 — 85% 초과 시 실질 현금 부담">
                          FCF {fcfPayout.toFixed(1)}%
                        </span>
                      )}
                      {zone === 'sell' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-orange-100 border-orange-300 text-orange-800 font-semibold">
                          ⛔ 고평가 + 재무부담 동시
                        </span>
                      )}
                    </div>

                    {/* 최근 실적 */}
                    {evt ? (
                      <div className="text-xs border-t border-slate-200/80 pt-2.5">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[#94A3B8] text-[10px]">{evt.reported_date}</span>
                          {evt.eps_surprise_pct != null && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${evt.eps_surprise_pct > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              EPS {evt.eps_surprise_pct > 0 ? '+' : ''}{evt.eps_surprise_pct.toFixed(1)}%
                            </span>
                          )}
                          {evt.guidance_tone && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              evt.guidance_tone === 'positive' ? 'bg-emerald-100 text-emerald-700'
                              : evt.guidance_tone === 'negative' ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                            }`}>
                              가이던스 {evt.guidance_tone === 'positive' ? '▲ 긍정' : evt.guidance_tone === 'negative' ? '▼ 부정' : '→ 중립'}
                            </span>
                          )}
                        </div>
                        <p className="text-[#475569] leading-relaxed text-[11px] line-clamp-2">{evt.summary}</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-300 border-t border-slate-200/80 pt-2">실적 뉴스 없음</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 관심 종목 테이블 */}
      {watching.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-16 text-center">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-[#64748B] font-medium">후보 종목이 없습니다</p>
          <p className="text-sm text-[#94A3B8] mt-2">
            스크리너 또는 신규 발굴 화면에서 종목을 추가하세요
          </p>
          <button
            onClick={() => router.push('/screener')}
            className="mt-4 px-4 py-2 text-sm text-[#1A56DB] border border-[#1A56DB] rounded-lg hover:bg-blue-50"
          >
            스크리너로 이동 →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-slate-50">
            <h2 className="text-sm font-semibold text-[#0F172A]">관심 종목 ({watching.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-slate-50/50">
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">티커</th>
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">종목명</th>
                <th className="text-right px-4 py-2.5 font-medium text-[#64748B]">현재가</th>
                <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">배당률</th>
                <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">신호</th>
                <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">
                  <span title="이자보상배율(EBIT ÷ 이자비용) — 금리 인상기 배당 유지 체력 확인. ≥5x 안전 / 3~5x 양호 / &lt;3x 위험">
                    ICR ⓘ
                  </span>
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">
                  <span title="실적 리스크 — EPS 미스 · 이익 급감 · 배당성향 과부하 여부">
                    실적 리스크 ⓘ
                  </span>
                </th>
                <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">목표주수</th>
                <th className="text-right px-4 py-2.5 font-medium text-[#64748B]">예상 연배당</th>
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">메모</th>
                <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">액션</th>
              </tr>
            </thead>
            <tbody>
              {watching.map(c => {
                const annualDiv = c.price && c.div_yield
                  ? c.price * c.target_shares * c.div_yield / 100
                  : null
                const isEditing = editingId === c.id
                return (
                  <tr key={c.id} className={`border-b border-[#E2E8F0] last:border-0 ${c.buy_signal ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-4 py-3 font-bold text-[#1A56DB]">{c.ticker}</td>
                    <td className="px-4 py-3 text-[#0F172A]">{c.name}</td>
                    <td className="px-4 py-3 text-right tabular">
                      {c.price ? (
                        <div>
                          <span className="font-medium">${c.price.toFixed(2)}</span>
                          {usdkrw && <p className="text-[10px] text-[#94A3B8]">₩{Math.round(c.price * usdkrw).toLocaleString()}</p>}
                        </div>
                      ) : <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.div_yield ? (
                        <span className={c.div_yield_5y && c.div_yield > c.div_yield_5y ? 'text-emerald-600 font-medium' : ''}>
                          {c.div_yield.toFixed(2)}%
                        </span>
                      ) : '–'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.buy_signal
                        ? <span title={c.signal_reason || ''}>⚡</span>
                        : <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderIcr(c.ticker)}
                    </td>
                    <td className="px-4 py-3">
                      {renderRisk(c.ticker)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          value={editShares}
                          onChange={e => setEditShares(Number(e.target.value))}
                          className="w-16 text-center border border-[#1A56DB] rounded px-1 py-0.5 text-sm"
                        />
                      ) : (
                        <span className="font-medium">{c.target_shares}주</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-sm">
                      {annualDiv ? (
                        <div>
                          <span className="font-medium">${annualDiv.toFixed(0)}</span>
                          {usdkrw && <p className="text-[10px] text-[#94A3B8]">₩{Math.round(annualDiv * usdkrw).toLocaleString()}</p>}
                        </div>
                      ) : '–'}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editMemo}
                          onChange={e => setEditMemo(e.target.value)}
                          placeholder="메모 입력"
                          className="w-full border border-[#E2E8F0] rounded px-2 py-0.5 text-sm"
                        />
                      ) : (
                        <span className="text-[#64748B] text-xs">{c.memo || '–'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-center">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(c.id)}
                              className="text-xs px-2 py-1 bg-[#1A56DB] text-white rounded hover:bg-blue-700"
                            >저장</button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs px-2 py-1 border border-[#E2E8F0] rounded hover:bg-slate-50"
                            >취소</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(c)}
                              className="text-xs px-2 py-1 border border-[#E2E8F0] rounded hover:bg-slate-50 text-[#64748B]"
                            >✏️</button>
                            <a
                              href={`https://naverconn.namusecurities.co.kr/link?code=${c.ticker}&exchange=NASDAQ`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            >매수</a>
                            <button
                              onClick={() => markPurchased(c.id)}
                              className="text-xs px-2 py-1 border border-emerald-300 text-emerald-600 rounded hover:bg-emerald-50"
                            >✓완료</button>
                            <button
                              onClick={() => remove(c.id)}
                              className="text-xs px-2 py-1 border border-red-200 text-red-400 rounded hover:bg-red-50"
                            >✕</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* ICR 범례 */}
          <div className="px-4 py-2.5 border-t border-[#E2E8F0] bg-slate-50/60 flex items-center gap-4 text-[10px] text-[#94A3B8]">
            <span className="font-medium text-[#64748B]">ICR (이자보상배율)</span>
            <span className="text-emerald-600">● ≥5x 안전</span>
            <span className="text-amber-600">● 3~5x 양호</span>
            <span className="text-red-500">● &lt;3x 위험</span>
            <span className="ml-auto">EBIT ÷ 이자비용 — 금리 인상기에도 이자를 갚으면서 배당을 유지할 체력</span>
          </div>
        </div>
      )}

      {/* 실적 이력 — 최근 실적 / 종목별 이력 탭 */}
      {earningsEvents.length > 0 && (() => {
        // 날짜별 그룹 (최근 실적 탭)
        const byDate: Record<string, EarningsEvent[]> = {}
        earningsEvents.forEach(e => {
          if (!byDate[e.reported_date]) byDate[e.reported_date] = []
          byDate[e.reported_date].push(e)
        })
        const dates = Object.keys(byDate).sort().reverse()

        // 종목별 그룹 (종목별 이력 탭) — watching 순서 유지
        const watchingTickers = watching.map(c => c.ticker)
        const byTicker: Record<string, EarningsEvent[]> = {}
        watchingTickers.forEach(t => {
          byTicker[t] = earningsEvents
            .filter(e => e.ticker === t)
            .sort((a, b) => b.reported_date.localeCompare(a.reported_date))
        })

        const toneConfig = (tone: string | null) => {
          if (tone === 'positive') return { dot: '●', cls: 'text-emerald-500', badge: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: '▲ 긍정' }
          if (tone === 'negative') return { dot: '✕', cls: 'text-red-500', badge: 'text-red-700 bg-red-50 border-red-200', label: '▼ 부정' }
          return { dot: '○', cls: 'text-slate-400', badge: 'text-slate-600 bg-slate-50 border-slate-200', label: '→ 중립' }
        }

        return (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            {/* 헤더 + 탭 */}
            <div className="px-4 py-3 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEarningsTab('recent')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    earningsTab === 'recent'
                      ? 'bg-[#1A56DB] text-white'
                      : 'text-[#64748B] hover:bg-slate-200'
                  }`}
                >📅 최근 실적</button>
                <button
                  onClick={() => setEarningsTab('history')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    earningsTab === 'history'
                      ? 'bg-[#1A56DB] text-white'
                      : 'text-[#64748B] hover:bg-slate-200'
                  }`}
                >📊 종목별 이력</button>
              </div>
              <span className="text-[10px] text-[#94A3B8]">매주 월요일 자동 수집</span>
            </div>

            {/* ── 최근 실적 탭 ── */}
            {earningsTab === 'recent' && (
              <div className="divide-y divide-[#E2E8F0]">
                {dates.map(date => (
                  <div key={date}>
                    <div className="px-4 py-2 bg-slate-50/60 flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#64748B]">{date}</span>
                      <span className="text-[10px] text-[#94A3B8]">실적 발표</span>
                    </div>
                    {byDate[date].map(e => {
                      const tc = toneConfig(e.guidance_tone)
                      return (
                        <div key={e.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                          <span className="text-sm font-bold text-[#1A56DB] w-14 shrink-0 pt-0.5">{e.ticker}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {e.eps_surprise_pct !== null && (
                                <span className={`text-xs font-semibold ${e.eps_surprise_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  EPS {e.eps_surprise_pct >= 0 ? '+' : ''}{e.eps_surprise_pct}%
                                </span>
                              )}
                              {e.guidance_tone && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${tc.badge}`}>
                                  {tc.label}
                                </span>
                              )}
                            </div>
                            {e.headline && (
                              <p className="text-xs font-medium text-[#0F172A] mb-1 leading-snug">{e.headline}</p>
                            )}
                            {e.summary && (
                              <p className="text-xs text-[#64748B] leading-relaxed">{e.summary}</p>
                            )}
                            {e.source_url && (
                              <a href={e.source_url} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-[#1A56DB] hover:underline mt-1 inline-block">원문 →</a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* ── 종목별 이력 탭 ── */}
            {earningsTab === 'history' && (
              <div className="divide-y divide-[#E2E8F0]">
                {watchingTickers.filter(t => byTicker[t]?.length > 0).map(ticker => {
                  const events = byTicker[ticker]
                  const isExpanded = expandedTicker === ticker
                  const latestTone = events[0]?.guidance_tone
                  const hasWarning = latestTone === 'negative' || latestTone === 'neutral'
                  const candidateName = watching.find(c => c.ticker === ticker)?.name || ticker

                  return (
                    <div key={ticker}>
                      <button
                        onClick={() => setExpandedTicker(isExpanded ? null : ticker)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                      >
                        <span className={`text-sm font-bold w-14 shrink-0 ${hasWarning && latestTone === 'negative' ? 'text-red-600' : 'text-[#1A56DB]'}`}>
                          {ticker}
                        </span>
                        {/* 트렌드 도트 */}
                        <div className="flex items-center gap-1">
                          {events.map((e, i) => {
                            const tc = toneConfig(e.guidance_tone)
                            return (
                              <span key={i} className={`text-base leading-none ${tc.cls}`} title={`${e.reported_date} · EPS ${e.eps_surprise_pct !== null ? (e.eps_surprise_pct >= 0 ? '+' : '') + e.eps_surprise_pct + '%' : '–'}`}>
                                {tc.dot}
                              </span>
                            )
                          })}
                        </div>
                        {/* 날짜 태그들 */}
                        <div className="flex items-center gap-1 flex-wrap flex-1">
                          {events.map((e, i) => (
                            <span key={i} className="text-[10px] text-[#94A3B8]">{e.reported_date.slice(0, 7)}</span>
                          ))}
                        </div>
                        {latestTone === 'neutral' && (
                          <span className="text-[10px] text-amber-600 font-medium shrink-0">최근 중립 주의</span>
                        )}
                        {latestTone === 'negative' && (
                          <span className="text-[10px] text-red-600 font-medium shrink-0">⚠️ 최근 부정</span>
                        )}
                        <span className="text-[#94A3B8] text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[#E2E8F0] bg-slate-50/40">
                          <p className="px-4 pt-2 pb-1 text-xs text-[#64748B] font-medium">{candidateName} · 분기별 실적</p>
                          {events.map(e => {
                            const tc = toneConfig(e.guidance_tone)
                            return (
                              <div key={e.id} className="px-4 py-2.5 border-t border-[#E2E8F0]/60 flex items-start gap-3">
                                <div className="flex items-center gap-1.5 w-28 shrink-0 pt-0.5">
                                  <span className={`text-sm ${tc.cls}`}>{tc.dot}</span>
                                  <span className="text-xs text-[#64748B]">{e.reported_date}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    {e.eps_surprise_pct !== null && (
                                      <span className={`text-xs font-semibold ${e.eps_surprise_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        EPS {e.eps_surprise_pct >= 0 ? '+' : ''}{e.eps_surprise_pct}%
                                      </span>
                                    )}
                                    <span className={`text-[10px] px-1 py-0.5 rounded border ${tc.badge}`}>{tc.label}</span>
                                  </div>
                                  {e.headline && <p className="text-xs font-medium text-[#0F172A] mb-0.5 leading-snug">{e.headline}</p>}
                                  {e.summary && <p className="text-xs text-[#64748B] leading-relaxed">{e.summary}</p>}
                                  {e.source_url && (
                                    <a href={e.source_url} target="_blank" rel="noopener noreferrer"
                                      className="text-[10px] text-[#1A56DB] hover:underline mt-0.5 inline-block">원문 →</a>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* 매수 완료 종목 */}
      {purchased.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-slate-50">
            <h2 className="text-sm font-semibold text-[#64748B]">매수 완료 ({purchased.length})</h2>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {purchased.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between text-sm text-[#64748B]">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[#0F172A]">{c.ticker}</span>
                  <span>{c.name}</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">매수완료</span>
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="text-xs text-[#94A3B8] hover:text-red-400"
                >제거</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
