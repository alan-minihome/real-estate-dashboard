'use client'

import { useEffect, useState } from 'react'
import KpiCard from './components/KpiCard'
import VerdictBadge from './components/VerdictBadge'
import { WATCHLIST } from '@/lib/watchlist'
import { AUTHOR_PORTFOLIO, PORTFOLIO_TEMPLATE, SUPER_INVESTOR_COMMON } from '@/lib/author-picks'

interface Stock { ticker: string; price: number|null; div_yield: number|null; div_yield_5y: number|null; fetched_at: string }
interface Screening { ticker: string; overall_pass: number; buy_signal: number; signal_reason: string|null }
interface CustomItem { ticker: string; name: string; sector: string|null; tier: string|null; years: number|null; note: string|null }
interface CandidateRow { ticker: string; name: string; status: string }

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso + 'Z').getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}분 전`
  if (m < 1440) return `${Math.floor(m/60)}시간 전`
  return `${Math.floor(m/1440)}일 전`
}

export default function HomePage() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [screening, setScreening] = useState<Screening[]>([])
  const [customWatchlist, setCustomWatchlist] = useState<CustomItem[]>([])
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [usdkrw, setUsdkrw] = useState<number|null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/stocks').then(r => r.json()),
      fetch('/api/market').then(r => r.json()).catch(() => null),
      fetch('/api/candidates').then(r => r.json()).catch(() => []),
    ]).then(([d, marketData, candidatesData]) => {
      if (d.error) { setError(d.error); return }
      setStocks(d.stocks || [])
      setScreening(d.screening || [])
      setCustomWatchlist(d.customWatchlist || [])
      if (Array.isArray(candidatesData)) setCandidates(candidatesData)
      if (marketData?.USDKRW?.price) setUsdkrw(marketData.USDKRW.price)
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])

  const stockMap = Object.fromEntries(stocks.map(s => [s.ticker, s]))
  // screening_results 우선 + candidates(이미 universe_screening 폴백 적용된 값) 보충
  const screenMap: Record<string, Screening> = Object.fromEntries(screening.map(s => [s.ticker, s]))
  for (const c of candidates) {
    if (!screenMap[c.ticker] && (c as unknown as { overall_pass?: number }).overall_pass !== undefined) {
      const cc = c as unknown as { ticker: string; overall_pass: number; buy_signal: number; signal_reason: string | null }
      screenMap[c.ticker] = {
        ticker: cc.ticker,
        overall_pass: cc.overall_pass,
        buy_signal: cc.buy_signal,
        signal_reason: cc.signal_reason,
      }
    }
  }

  // 후보함(watching) + WATCHLIST + custom 통합
  type Row = { ticker: string; name: string; source: 'candidate' | 'watchlist' | 'custom'; isCustom?: boolean }
  const seen = new Set<string>()
  const mergedList: Row[] = []
  for (const c of candidates.filter(c => c.status === 'watching')) {
    if (seen.has(c.ticker)) continue; seen.add(c.ticker)
    mergedList.push({ ticker: c.ticker, name: c.name, source: 'candidate' })
  }
  for (const w of WATCHLIST) {
    if (seen.has(w.ticker)) continue; seen.add(w.ticker)
    mergedList.push({ ticker: w.ticker, name: w.name, source: 'watchlist' })
  }
  for (const c of customWatchlist) {
    if (seen.has(c.ticker)) continue; seen.add(c.ticker)
    mergedList.push({ ticker: c.ticker, name: c.name || c.ticker, source: 'custom', isCustom: true })
  }

  const total = mergedList.length
  const passed = mergedList.filter(w => screenMap[w.ticker]?.overall_pass === 1).length
  // 진짜 매수 신호: 기준통과 ✅ AND 가격 매력 ⚡ 둘 다 만족
  const buySignals = mergedList
    .filter(w => {
      const sc = screenMap[w.ticker]
      return sc?.overall_pass === 1 && sc?.buy_signal === 1
    })
    .map(w => ({ ...w, sc: screenMap[w.ticker]! }))
  // 가격 매력만 (참고용)
  const priceOnlySignals = mergedList.filter(w => {
    const sc = screenMap[w.ticker]
    return sc?.buy_signal === 1 && sc?.overall_pass !== 1
  }).length
  const passPct = total ? Math.round(passed / total * 100) : 0
  const latestFetchedAt = stocks.reduce((max, s) => s.fetched_at > max ? s.fetched_at : max, '')
  const lastUpdate = latestFetchedAt ? relativeTime(latestFetchedAt) : '없음'

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const r = await fetch('/api/refresh', { method: 'POST' })
      const d = await r.json()
      if (d.ok) {
        const [d2, candidatesData] = await Promise.all([
          fetch('/api/stocks').then(r2 => r2.json()),
          fetch('/api/candidates').then(r2 => r2.json()).catch(() => []),
        ])
        setStocks(d2.stocks || [])
        setScreening(d2.screening || [])
        setCustomWatchlist(d2.customWatchlist || [])
        if (Array.isArray(candidatesData)) setCandidates(candidatesData)
        setError('')
      } else {
        setError(d.error || '갱신 실패')
      }
    } catch(e) { setError(String(e)) } finally { setRefreshing(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>

  return (
    <div className="max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">배당주 대시보드</h1>
          <p className="text-sm text-[#64748B] mt-0.5">미국 배당성장주 모니터링 · 2주 단위 자동 갱신</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {refreshing ? '갱신 중...' : '🔄 데이터 갱신'}
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* KPI 4개 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="감시 종목" value={total} href="/screener" />
        <KpiCard label="기준 통과" value={`${passed} / ${total}`} sub={`${passPct}%`} accent href="/screener" />
        <KpiCard label="⚡ 매수 신호" value={buySignals.length} sub={buySignals.length > 0 ? '신호 발생!' : '신호 없음'} signal={buySignals.length > 0} href="/signals" />
        <KpiCard label="마지막 갱신" value={lastUpdate} />
      </div>

      {/* 선별 현황 진행바 */}
      <div className="mb-6 bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#0F172A]">선별 현황</span>
          <span className="text-sm text-[#64748B]">{passed}/{total} ({passPct}%)</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#1A56DB] rounded-full transition-all duration-500" style={{ width: `${passPct}%` }} />
        </div>
      </div>

      {/* 매수 신호 — 기준통과 + 가격 매력 둘 다 만족하는 진짜 신호만 */}
      {buySignals.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3">
            🎯 매수 후보 {buySignals.length}건
            <span className="ml-2 text-xs font-normal text-[#94A3B8]">기준 ✅ + 가격 ⚡ 둘 다 통과</span>
            {priceOnlySignals > 0 && (
              <span className="ml-2 text-xs font-normal text-amber-600">
                · 가격만 매력 {priceOnlySignals}건
              </span>
            )}
          </h2>
          <div className="flex flex-col gap-2">
            {buySignals.map(({ ticker, name, source, sc }) => {
              const s = stockMap[ticker]
              return (
                <div key={ticker} className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2 w-52 shrink-0">
                    <span className="text-base font-bold text-emerald-700">{ticker}</span>
                    {source === 'candidate' && <span className="text-[10px] bg-blue-100 text-[#1A56DB] px-1.5 py-0.5 rounded-full">후보</span>}
                    {source === 'custom' && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">감시</span>}
                    <span className="text-sm font-semibold text-[#0F172A]">{name}</span>
                  </div>
                  <span className="flex-1 text-sm text-slate-500">
                    ${s?.price?.toFixed(2) ?? '–'}
                    {usdkrw && s?.price ? ` (₩${Math.round(s.price * usdkrw).toLocaleString()})` : ''}
                    {' '}· 배당률 {s?.div_yield?.toFixed(2) ?? '–'}%
                  </span>
                  <span className="text-sm font-medium text-emerald-700">{sc.signal_reason}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 감시 종목 현황 테이블 */}
      <div>
        <h2 className="text-base font-semibold mb-3">📋 감시 종목 현황</h2>
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                <th className="text-left px-4 py-3 font-medium text-[#64748B]">티커</th>
                <th className="text-left px-4 py-3 font-medium text-[#64748B]">종목명</th>
                <th className="text-right px-4 py-3 font-medium text-[#64748B]">주가</th>
                <th className="text-right px-4 py-3 font-medium text-[#64748B]">배당률</th>
                <th className="text-right px-4 py-3 font-medium text-[#64748B]">5년 평균</th>
                <th className="text-center px-4 py-3 font-medium text-[#64748B]">기준통과</th>
                <th className="text-center px-4 py-3 font-medium text-[#64748B]">매수신호</th>
                <th className="text-center px-4 py-3 font-medium text-[#64748B] min-w-[100px]">🎯 결과</th>
              </tr>
            </thead>
            <tbody>
              {[...mergedList].sort((a, b) => {
                const sa = screenMap[a.ticker], sb = screenMap[b.ticker]
                if ((sb?.buy_signal ?? 0) !== (sa?.buy_signal ?? 0)) return (sb?.buy_signal ?? 0) - (sa?.buy_signal ?? 0)
                if ((sb?.overall_pass ?? 0) !== (sa?.overall_pass ?? 0)) return (sb?.overall_pass ?? 0) - (sa?.overall_pass ?? 0)
                return 0
              }).map((w, i) => {
                const s = stockMap[w.ticker]
                const sc = screenMap[w.ticker]
                return (
                  <tr key={w.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                    <td className="px-4 py-3 font-bold text-[#1A56DB]">
                      {w.ticker}
                      {w.source === 'candidate' && <span className="ml-1 text-[10px] bg-blue-100 text-[#1A56DB] px-1.5 py-0.5 rounded-full align-middle">후보</span>}
                      {w.source === 'custom' && <span className="ml-1 text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full align-middle">감시</span>}
                    </td>
                    <td className="px-4 py-3 text-[#0F172A]">{w.name}</td>
                    <td className="px-4 py-3 text-right tabular">
                      {s?.price ? (
                        <div>
                          <p className="font-medium">${s.price.toFixed(2)}</p>
                          {usdkrw && <p className="text-xs text-[#64748B]">₩{Math.round(s.price * usdkrw).toLocaleString()}</p>}
                        </div>
                      ) : '–'}
                    </td>
                    <td className="px-4 py-3 text-right tabular">{s?.div_yield ? `${s.div_yield.toFixed(2)}%` : '–'}</td>
                    <td className="px-4 py-3 text-right tabular text-[#64748B]">{s?.div_yield_5y ? `${s.div_yield_5y.toFixed(2)}%` : '–'}</td>
                    <td className="px-4 py-3 text-center">{sc ? (sc.overall_pass ? '✅' : '❌') : '–'}</td>
                    <td className="px-4 py-3 text-center">{sc?.buy_signal ? '⚡' : ''}</td>
                    <td className="px-4 py-3 text-center">
                      <VerdictBadge overallPass={sc?.overall_pass} buySignal={sc?.buy_signal} signalReason={sc?.signal_reason} size="sm" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 저자 추천 종목 (책 『배당주로 연봉벌기』 기반) */}
      <div className="mt-8 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-[#0F172A]">📖 저자 추천 종목</h2>
          <span className="text-xs text-[#94A3B8]">『배당주로 연봉벌기』 · 25.12.28 기준</span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* 저자 본인 보유 포트폴리오 */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#0F172A]">저자 보유 포트폴리오</p>
              <span className="text-[10px] text-[#94A3B8]">{AUTHOR_PORTFOLIO.length}종목</span>
            </div>
            <div className="space-y-1.5">
              {AUTHOR_PORTFOLIO.map(p => {
                const s = stockMap[p.ticker]
                const sc = screenMap[p.ticker]
                return (
                  <div key={p.ticker} className="flex items-center justify-between text-xs py-1 border-b border-[#F1F5F9] last:border-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold ${p.category === '핵심' ? 'text-amber-600' : 'text-[#1A56DB]'}`}>{p.ticker}</span>
                      <span className="text-[#64748B]">{p.name}</span>
                      {p.category === '핵심' && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">★ 핵심</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {s?.div_yield && <span className="text-[10px] text-[#64748B]">{s.div_yield.toFixed(2)}%</span>}
                      {sc?.buy_signal === 1 && <span title={sc.signal_reason || ''}>⚡</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 3억 포트폴리오 템플릿 */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#0F172A]">3억 포트폴리오 템플릿</p>
              <span className="text-[10px] text-[#94A3B8]">월 세후 약 90만원</span>
            </div>
            <div className="space-y-1.5">
              {['고배당', '중배당', '배당성장'].map(cat => (
                <div key={cat}>
                  <p className="text-[10px] text-[#94A3B8] mt-1.5 mb-0.5 uppercase">{cat}</p>
                  {PORTFOLIO_TEMPLATE.filter(p => p.category === cat).map(p => {
                    const s = stockMap[p.ticker]
                    return (
                      <div key={p.ticker + cat} className="flex items-center justify-between text-xs py-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#1A56DB]">{p.ticker}</span>
                          <span className="text-[#64748B]">{p.name}</span>
                        </div>
                        {s?.div_yield && <span className="text-[10px] text-[#64748B]">{s.div_yield.toFixed(2)}%</span>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* 4대 가치투자 대가 공통보유 */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#0F172A]">대가 공통 보유</p>
              <span className="text-[10px] text-[#94A3B8]">버핏·약트먼·아크레·그랜덤</span>
            </div>
            <div className="space-y-1.5">
              {SUPER_INVESTOR_COMMON.map(p => {
                const s = stockMap[p.ticker]
                const sc = screenMap[p.ticker]
                return (
                  <div key={p.ticker} className="flex items-center justify-between text-xs py-1 border-b border-[#F1F5F9] last:border-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-[#1A56DB]">{p.ticker}</span>
                      <span className="text-[#64748B] truncate">{p.note}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s?.div_yield && <span className="text-[10px] text-[#64748B]">{s.div_yield.toFixed(2)}%</span>}
                      {sc?.buy_signal === 1 && <span title={sc.signal_reason || ''}>⚡</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <p className="mt-3 text-[10px] text-[#94A3B8]">
          ★ 핵심 5종목은 자동으로 예비 후보함에 시드되어 있습니다 · ⚡ = 현재 매수 신호 발생
        </p>
      </div>
    </div>
  )
}
